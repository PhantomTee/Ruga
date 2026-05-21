/**
 * RugCheck.xyz — Solana rug detection
 * Fetches recently flagged high-risk tokens (score > 500 / 1000)
 */

import type { RawSignal } from "./types";

const BASE = "https://api.rugcheck.xyz/v1";

type RCEntry = {
  mint: string;
  score: number;
  tokenMeta?: { symbol?: string; name?: string };
  symbol?: string;
  name?: string;
};

async function rcGet<T>(path: string): Promise<T | null> {
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

export async function fetchRugCheckSignals(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  // RugCheck "top flagged" — returns tokens with worst risk scores
  const raw = await rcGet<RCEntry[] | { tokens?: RCEntry[] }>("/stats/topFlagged?limit=30");
  const tokens: RCEntry[] = Array.isArray(raw)
    ? raw
    : (raw as { tokens?: RCEntry[] } | null)?.tokens ?? [];

  for (const token of tokens) {
    if ((token.score ?? 0) < 500) continue;
    const symbol = (token.tokenMeta?.symbol ?? token.symbol ?? "").toUpperCase().trim();
    const name = token.tokenMeta?.name ?? token.name ?? symbol;
    if (!symbol || symbol.length < 2 || symbol.length > 12) continue;

    signals.push({
      symbol,
      name,
      source: "rugcheck",
      reason: `RugCheck risk score ${token.score}/1000 — flagged high risk on Solana`,
      address: token.mint,
      chain: "solana"
    });
  }

  return signals;
}
