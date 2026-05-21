/**
 * DexScreener — cross-chain rug pattern detection
 * Watches newly listed token profiles for price crash signatures:
 *   - 24h price drop > 60%
 *   - Non-zero trading volume (panic sells happened)
 *   - Remaining liquidity < $10k (LP already drained)
 */

import type { RawSignal } from "./types";

const BASE = "https://api.dexscreener.com";

type TokenProfile = {
  chainId: string;
  tokenAddress: string;
};

type DexPair = {
  baseToken: { symbol: string; name: string; address: string };
  chainId: string;
  priceChange?: { h24?: number; h6?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
};

async function dsGet<T>(path: string): Promise<T | null> {
  try {
    const resp = await fetch(`${BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 0 } as RequestInit["next"]
    });
    if (!resp.ok) return null;
    return resp.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function fetchDexScreenerSignals(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // Latest token profiles = newest tokens listed on DexScreener
  const profiles = await dsGet<TokenProfile[]>("/token-profiles/latest/v1");
  if (!profiles?.length) return signals;

  const toCheck = profiles.slice(0, 20);

  for (const profile of toCheck) {
    try {
      await new Promise((r) => setTimeout(r, 200)); // gentle rate limiting

      const pairsData = await dsGet<{ pairs?: DexPair[] }>(
        `/latest/dex/tokens/${profile.tokenAddress}`
      );
      if (!pairsData?.pairs?.length) continue;

      // Use most-liquid pair as the reference
      const pair = pairsData.pairs.sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];

      const priceChange24h = pair.priceChange?.h24 ?? 0;
      const volume24h = pair.volume?.h24 ?? 0;
      const liquidity = pair.liquidity?.usd ?? 0;

      // Rug signature: massive dump + some panic selling + near-zero liquidity
      if (priceChange24h < -60 && volume24h > 500 && liquidity < 10_000) {
        const symbol = pair.baseToken.symbol.toUpperCase().trim();
        if (!symbol || symbol.length < 2 || symbol.length > 12) continue;

        signals.push({
          symbol,
          name: pair.baseToken.name || symbol,
          source: "dexscreener",
          reason: `DexScreener: ${priceChange24h.toFixed(1)}% 24h drop · $${Math.round(volume24h).toLocaleString()} volume · $${Math.round(liquidity).toLocaleString()} liquidity — rug pattern`,
          address: pair.baseToken.address,
          chain: pair.chainId
        });
      }
    } catch {
      continue;
    }
  }

  return signals;
}
