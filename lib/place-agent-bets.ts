import { formatUnits, parseUnits } from "ethers";
import { agentPlaceBet, getAgentWalletAddress } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

type BetResult = { marketId: number; symbol: string; amount: number; txHash: string };

function stakeForConfidence(confidence: number): number {
  if (confidence >= 90) return 15;
  if (confidence >= 80) return 10;
  return 5;
}

function addUsdc(a: string | number | null, b: string): string {
  return formatUnits(parseUnits(String(a || "0"), 6) + parseUnits(b, 6), 6);
}

export async function placeAgentBets(): Promise<{ bets: BetResult[]; skipped?: string }> {
  const supabase = getSupabaseAdmin();
  const agentAddress = getAgentWalletAddress().toLowerCase();

  const { data: markets, error } = await supabase
    .from("markets")
    .select("id, on_chain_id, groq_confidence, token_symbol, yes_pool")
    .eq("resolved", false)
    .gte("groq_confidence", 70)
    .order("groq_confidence", { ascending: false });
  if (error) throw error;

  if (!markets?.length) return { bets: [], skipped: "no eligible markets" };

  const marketIds = markets.map((m) => m.id);
  const { data: existingBets } = await supabase
    .from("bets")
    .select("market_id")
    .eq("wallet_address", agentAddress)
    .in("market_id", marketIds);

  const alreadyBet = new Set((existingBets || []).map((b) => b.market_id));
  const eligible = markets.filter((m) => !alreadyBet.has(m.id)).slice(0, 3);

  if (!eligible.length) return { bets: [], skipped: "already bet on all eligible markets" };

  const bets: BetResult[] = [];

  for (const market of eligible) {
    const amount = stakeForConfidence(market.groq_confidence ?? 70);
    try {
      const { txHash, walletAddress } = await agentPlaceBet(Number(market.on_chain_id), "yes", amount);

      await supabase.from("bets").insert({
        market_id: market.id,
        wallet_address: walletAddress.toLowerCase(),
        side: "yes",
        amount: String(amount),
        tx_hash: txHash,
      });

      await supabase
        .from("markets")
        .update({ yes_pool: addUsdc(market.yes_pool, String(amount)) })
        .eq("id", market.id);

      bets.push({ marketId: market.id, symbol: market.token_symbol, amount, txHash });
    } catch (err) {
      console.error(`Agent bet failed for market ${market.id} (${market.token_symbol}):`, toMessage(err));
    }
  }

  return { bets };
}
