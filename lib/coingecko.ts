import { PRICE_SCALE } from "./constants";

type CoinGeckoSearch = {
  coins: Array<{ id: string; name: string; symbol: string; market_cap_rank: number | null }>;
};

function cgHeaders(): Record<string, string> {
  const apiKey = process.env.COINGECKO_API_KEY;
  // CG- prefix = demo key, otherwise pro key — different headers
  const keyHeader = apiKey?.startsWith("CG-") ? "x-cg-demo-api-key" : "x-cg-pro-api-key";
  return {
    accept: "application/json",
    ...(apiKey ? { [keyHeader]: apiKey } : {})
  };
}

async function cgFetch(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { ...init, headers: { ...cgHeaders(), ...(init?.headers as Record<string, string> | undefined) } });
    if (response.status !== 429) return response;
    const retryAfter = Number(response.headers.get("retry-after") || "10");
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
  }
  throw new Error("CoinGecko rate limit exceeded after 3 retries");
}

export async function lookupCoin(symbol: string) {
  const response = await cgFetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
    { next: { revalidate: 0 } } as RequestInit
  );
  if (!response.ok) throw new Error(`CoinGecko search failed: ${response.status}`);
  const data = (await response.json()) as CoinGeckoSearch;
  const upper = symbol.toUpperCase();
  // Require exact symbol match to avoid creating a market for the wrong coin
  return data.coins.find((c) => c.symbol.toUpperCase() === upper) || null;
}

export async function getUsdPrice(coingeckoId: string) {
  const response = await cgFetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`,
    { next: { revalidate: 0 } } as RequestInit
  );
  if (!response.ok) throw new Error(`CoinGecko price failed: ${response.status}`);
  const data = (await response.json()) as Record<string, { usd?: number }>;
  const price = data[coingeckoId]?.usd;
  if (!price || price <= 0) throw new Error(`CoinGecko returned no USD price for ${coingeckoId}`);
  return price;
}

export function scaleUsd(price: number) {
  return BigInt(Math.round(price * PRICE_SCALE));
}

/**
 * Price fallback when a token isn't listed on CoinGecko.
 * Searches DexScreener by symbol and returns the USD price
 * from the most-liquid matching pair.
 */
export async function lookupPriceFromDex(symbol: string): Promise<{ price: number; name: string } | null> {
  try {
    const resp = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8_000)
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json() as {
      pairs?: Array<{
        baseToken: { symbol: string; name: string };
        priceUsd?: string;
        liquidity?: { usd?: number };
      }>;
    };
    const upper = symbol.toUpperCase();
    const matching = (data.pairs ?? [])
      .filter((p) => p.baseToken.symbol.toUpperCase() === upper && Number(p.priceUsd) > 0)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    if (!matching.length) return null;
    return {
      price: Number(matching[0].priceUsd),
      name: matching[0].baseToken.name || symbol
    };
  } catch {
    return null;
  }
}

export async function getMarketChart(coingeckoId: string) {
  const response = await cgFetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}/market_chart?vs_currency=usd&days=7`,
    { next: { revalidate: 60 } } as RequestInit
  );
  if (!response.ok) throw new Error(`CoinGecko chart failed: ${response.status}`);
  return (await response.json()) as { prices: Array<[number, number]> };
}

/**
 * Fetch OHLCV candle data from DexScreener for a given pair.
 * Returns prices as [timestamp_ms, close_price] pairs compatible with PriceChart.
 */
export async function getDexChartData(
  chain: string,
  pairAddress: string
): Promise<Array<[number, number]> | null> {
  try {
    // DexScreener candles: 1h resolution for last 7 days
    const resp = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) }
    );
    if (!resp.ok) return null;
    const data = await resp.json() as {
      pair?: {
        priceUsd?: string;
        priceChange?: { h1?: number; h6?: number; h24?: number };
        volume?: { h24?: number };
      };
    };
    const pair = data.pair;
    if (!pair || !pair.priceUsd) return null;

    // DexScreener doesn't expose free historical OHLCV.
    // Reconstruct a rough 7-point price curve from the available change data.
    const currentPrice = Number(pair.priceUsd);
    if (!currentPrice) return null;

    const now = Date.now();
    const h1Change = (pair.priceChange?.h1 ?? 0) / 100;
    const h6Change = (pair.priceChange?.h6 ?? 0) / 100;
    const h24Change = (pair.priceChange?.h24 ?? 0) / 100;

    // Interpolate backwards using the known % changes
    const price1h = currentPrice / (1 + h1Change || 1);
    const price6h = currentPrice / (1 + h6Change || 1);
    const price24h = currentPrice / (1 + h24Change || 1);

    const points: Array<[number, number]> = [
      [now - 24 * 60 * 60 * 1000, price24h],
      [now - 12 * 60 * 60 * 1000, (price24h + price6h) / 2],
      [now - 6 * 60 * 60 * 1000, price6h],
      [now - 3 * 60 * 60 * 1000, (price6h + price1h) / 2],
      [now - 1 * 60 * 60 * 1000, price1h],
      [now - 30 * 60 * 1000, (price1h + currentPrice) / 2],
      [now, currentPrice],
    ].filter(([, p]) => p > 0) as Array<[number, number]>;

    return points.length >= 2 ? points : null;
  } catch {
    return null;
  }
}
