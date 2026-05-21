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
  priceUsd?: string;
  priceChange?: { h24?: number; h6?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  pairCreatedAt?: number;
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

export type DexNewListing = {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  priceUsd: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  reason: string;
};

/**
 * Proactive market seeding — fetches brand-new DexScreener listings with
 * suspicious risk profiles (tiny liquidity vs FDV, first-hour volume spike)
 * so there are always markets to bet on, even before a rug happens.
 */
export async function fetchDexScreenerNewListings(): Promise<DexNewListing[]> {
  const results: DexNewListing[] = [];

  const profiles = await dsGet<TokenProfile[]>("/token-profiles/latest/v1");
  if (!profiles?.length) return results;

  // Shuffle so we don't always check the same top-N
  const shuffled = profiles
    .slice(0, 50)
    .sort(() => Math.random() - 0.5)
    .slice(0, 25);

  for (const profile of shuffled) {
    if (results.length >= 5) break; // candidates pool cap
    try {
      await new Promise((r) => setTimeout(r, 200));

      const pairsData = await dsGet<{ pairs?: DexPair[] }>(
        `/latest/dex/tokens/${profile.tokenAddress}`
      );
      if (!pairsData?.pairs?.length) continue;

      const pair = pairsData.pairs.sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];

      const priceUsd = Number(pair.priceUsd ?? 0);
      const volume24h = pair.volume?.h24 ?? 0;
      const liquidity = pair.liquidity?.usd ?? 0;
      const fdv = pair.fdv ?? 0;
      const priceChange24h = pair.priceChange?.h24 ?? 0;

      // Must have a real price and some trading activity
      if (priceUsd <= 0 || volume24h < 500 || liquidity < 1_000) continue;

      // Not already in freefall (that's the rug detector's job)
      if (priceChange24h < -50) continue;

      // Risky profile: very low liquidity-to-FDV ratio OR tiny absolute liquidity
      const lowLiqRatio = fdv > 0 && liquidity / fdv < 0.03;
      const tinyLiq = liquidity < 30_000;
      if (!lowLiqRatio && !tinyLiq) continue;

      const symbol = pair.baseToken.symbol.toUpperCase().trim();
      if (!symbol || symbol.length < 2 || symbol.length > 12) continue;

      const reasons: string[] = [];
      if (lowLiqRatio) reasons.push(`only ${((liquidity / fdv) * 100).toFixed(1)}% of FDV is liquid`);
      if (tinyLiq) reasons.push(`$${Math.round(liquidity).toLocaleString()} total liquidity`);
      reasons.push(`$${Math.round(volume24h).toLocaleString()} 24h volume`);

      results.push({
        symbol,
        name: pair.baseToken.name || symbol,
        address: pair.baseToken.address,
        chain: pair.chainId,
        priceUsd,
        volume24h,
        liquidity,
        fdv,
        reason: `New listing flagged: ${reasons.join(", ")} — high rug potential`
      });
    } catch {
      continue;
    }
  }

  return results;
}
