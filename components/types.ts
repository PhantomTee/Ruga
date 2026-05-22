export type Market = {
  id: number;
  on_chain_id: number;
  display_id?: number | null;
  token_symbol?: string;
  tokenSymbol?: string;
  token_name?: string | null;
  tokenName?: string | null;
  coingecko_id?: string | null;
  coingeckoId?: string | null;
  commit_sha?: string | null;
  commit_message?: string | null;
  groq_reasoning?: string | null;
  groq_confidence?: number | null;
  price_at_creation?: string | number | null;
  priceAtCreation?: string | number | null;
  yes_pool?: string | number | null;
  yesPool?: string | number | null;
  no_pool?: string | number | null;
  noPool?: string | number | null;
  created_at?: string;
  createdAt?: string;
  resolves_at?: string | null;
  resolvesAt?: string | null;
  resolved: boolean;
  outcome: boolean | null;
  final_price?: string | number | null;
  userBets?: { yes: string; no: string };
};

export type FeedItem = {
  sha: string;
  commit_message: string | null;
  tokens_found: string[] | null;
  status: "processing" | "scanned" | "signal_found" | "market_created" | "ignored" | "failed";
  processed_at: string;
};

export type Bet = {
  id: string;
  market_id: number;
  wallet_address: string;
  side: "yes" | "no";
  amount: string | number;
  tx_hash: string;
  created_at: string;
};

export function marketSymbol(market: Market) {
  return market.tokenSymbol || market.token_symbol || "UNKNOWN";
}

export function marketName(market: Market) {
  return market.tokenName || market.token_name || marketSymbol(market);
}

export function yesPool(market: Market) {
  return Number(market.yesPool ?? market.yes_pool ?? 0);
}

export function noPool(market: Market) {
  return Number(market.noPool ?? market.no_pool ?? 0);
}

export function resolvesAt(market: Market) {
  return market.resolvesAt || market.resolves_at || null;
}

export function coingeckoId(market: Market) {
  return market.coingeckoId || market.coingecko_id || null;
}
