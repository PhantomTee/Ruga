export const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID);
export const ARC_RPC = process.env.NEXT_PUBLIC_ARC_RPC;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS;
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
export const NFI_REPO = "iterativv/NostalgiaForInfinity";
export const NFI_COMMITS_URL = `https://api.github.com/repos/${NFI_REPO}/commits`;
export const PRICE_SCALE = 100_000_000;

export type MarketRecord = {
  id: number;
  on_chain_id: number;
  token_symbol: string;
  token_name: string | null;
  coingecko_id: string | null;
  commit_sha: string | null;
  commit_message: string | null;
  groq_reasoning: string | null;
  groq_confidence: number | null;
  price_at_creation: string | number | null;
  yes_pool: string | number | null;
  no_pool: string | number | null;
  created_at: string;
  resolves_at: string | null;
  resolved: boolean;
  outcome: boolean | null;
  final_price: string | number | null;
};
