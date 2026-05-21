/**
 * Signal aggregator — gathers from all sources in parallel,
 * deduplicates by symbol, and returns a ranked list.
 *
 * Confidence threshold for market creation:
 *   - 1 source  → Groq must score ≥ 70
 *   - 2+ sources → Groq must score ≥ 55  (multiple independent confirmations)
 */

import type { RawSignal, AggregatedSignal } from "./types";
import { fetchRugCheckSignals } from "./rugcheck";
import { fetchDexScreenerSignals } from "./dexscreener";
import { enrichWithGoPlusSecurity } from "./gopluslabs";

export type { RawSignal, AggregatedSignal };

export async function gatherExternalSignals(): Promise<AggregatedSignal[]> {
  // Fetch RugCheck and DexScreener in parallel
  const [rugcheckSignals, dexSignals] = await Promise.all([
    fetchRugCheckSignals().catch(() => [] as RawSignal[]),
    fetchDexScreenerSignals().catch(() => [] as RawSignal[])
  ]);

  // Enrich EVM tokens from DexScreener with GoPlusLabs security check
  const enriched: RawSignal[] = [...rugcheckSignals, ...dexSignals];
  for (const sig of dexSignals) {
    if (sig.address && sig.chain && sig.chain !== "solana") {
      const gpl = await enrichWithGoPlusSecurity(
        sig.address,
        sig.chain,
        sig.symbol,
        sig.name
      ).catch(() => null);
      if (gpl) enriched.push(gpl);
    }
  }

  // Aggregate by symbol
  const map = new Map<string, AggregatedSignal>();
  for (const sig of enriched) {
    const key = sig.symbol.toUpperCase();
    const existing = map.get(key);
    if (existing) {
      if (!existing.sources.includes(sig.source)) existing.sources.push(sig.source);
      existing.reasons.push(sig.reason);
      existing.address ??= sig.address;
      existing.chain ??= sig.chain;
    } else {
      map.set(key, {
        symbol: key,
        name: sig.name || key,
        sources: [sig.source],
        reasons: [sig.reason],
        address: sig.address,
        chain: sig.chain
      });
    }
  }

  // Sort: multi-source signals first
  return [...map.values()].sort((a, b) => b.sources.length - a.sources.length);
}
