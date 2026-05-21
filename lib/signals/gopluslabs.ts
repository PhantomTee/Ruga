/**
 * GoPlusSecurity — EVM token security enrichment
 * Called for EVM tokens found by DexScreener to add a second confirmation signal.
 * Flags: honeypot, cannot-sell, extreme sell tax, creator holds majority supply.
 */

import type { RawSignal } from "./types";

const BASE = "https://api.gopluslabs.io/api/v1";

type GPLResult = {
  [address: string]: {
    is_honeypot?: string;
    cannot_sell_all?: string;
    is_blacklisted?: string;
    token_symbol?: string;
    token_name?: string;
    sell_tax?: string;
    buy_tax?: string;
    creator_percent?: string;
  };
};

// DexScreener chainId → GoPlusLabs numeric chain ID
const CHAIN_MAP: Record<string, string> = {
  ethereum: "1",
  eth: "1",
  bsc: "56",
  polygon: "137",
  matic: "137",
  arbitrum: "42161",
  base: "8453",
  avalanche: "43114",
  avax: "43114",
  optimism: "10"
};

export async function enrichWithGoPlusSecurity(
  address: string,
  chainId: string,
  symbol: string,
  name: string
): Promise<RawSignal | null> {
  const numericChain = CHAIN_MAP[chainId.toLowerCase()];
  if (!numericChain) return null;

  try {
    const resp = await fetch(
      `${BASE}/token_security/${numericChain}?contract_addresses=${address}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!resp.ok) return null;

    const data = (await resp.json()) as { result?: GPLResult };
    const result = data.result;
    if (!result) return null;

    const info = result[address.toLowerCase()] ?? result[address];
    if (!info) return null;

    const isHoneypot = info.is_honeypot === "1";
    const cantSell = info.cannot_sell_all === "1";
    const highSellTax = Number(info.sell_tax ?? 0) > 50;
    const creatorDominant = Number(info.creator_percent ?? 0) > 50;

    if (!isHoneypot && !cantSell && !highSellTax && !creatorDominant) return null;

    const flags = [
      isHoneypot && "honeypot",
      cantSell && "cannot sell all tokens",
      highSellTax && `${info.sell_tax}% sell tax`,
      creatorDominant && `creator holds ${info.creator_percent}% of supply`
    ]
      .filter(Boolean)
      .join(", ");

    return {
      symbol: symbol.toUpperCase(),
      name,
      source: "gopluslabs",
      reason: `GoPlusSecurity: ${flags}`,
      address,
      chain: chainId
    };
  } catch {
    return null;
  }
}
