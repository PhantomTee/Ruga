import { PRICE_SCALE } from "./constants";

type CoinGeckoSearch = {
  coins: Array<{ id: string; name: string; symbol: string; market_cap_rank: number | null }>;
};

function cgHeaders(): Record<string, string> {
  const apiKey = process.env.COINGECKO_API_KEY;
  return {
    accept: "application/json",
    ...(apiKey ? { "x-cg-pro-api-key": apiKey } : {})
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

export async function getMarketChart(coingeckoId: string) {
  const response = await cgFetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}/market_chart?vs_currency=usd&days=7`,
    { next: { revalidate: 60 } } as RequestInit
  );
  if (!response.ok) throw new Error(`CoinGecko chart failed: ${response.status}`);
  return (await response.json()) as { prices: Array<[number, number]> };
}
