import { NextRequest, NextResponse } from "next/server";
import { formatUnits, parseUnits } from "ethers";
import { assertAgentAuthorized } from "@/lib/agent-auth";
import { agentPlaceBet, getAgentWalletAddress } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Confidence → USDC stake
function stakeForConfidence(confidence: number): number {
  if (confidence >= 90) return 15;
  if (confidence >= 80) return 10;
  return 5;
}

function addUsdc(a: string | number | null, b: string): string {
  return formatUnits(parseUnits(String(a || "0"), 6) + parseUnits(b, 6), 6);
}

export async function POST(request: NextRequest) {
  try {
    assertAgentAuthorized(request);

    const supabase = getSupabaseAdmin();
    const agentAddress = getAgentWalletAddress().toLowerCase();

    // Strict criteria: active, HIGH RISK confidence only
    const { data: markets, error } = await supabase
      .from("markets")
      .select("id, on_chain_id, groq_confidence, token_symbol, yes_pool")
      .eq("resolved", false)
      .gte("groq_confidence", 70)
      .order("groq_confidence", { ascending: false });
    if (error) throw error;

    if (!markets?.length) return NextResponse.json({ bets: [], skipped: "no eligible markets" });

    // Find markets the agent hasn't bet on yet
    const marketIds = markets.map((m) => m.id);
    const { data: existingBets } = await supabase
      .from("bets")
      .select("market_id")
      .eq("wallet_address", agentAddress)
      .in("market_id", marketIds);

    const alreadyBet = new Set((existingBets || []).map((b) => b.market_id));
    // Limit to the 3 highest-confidence markets the agent hasn't bet on yet
    const eligible = markets.filter((m) => !alreadyBet.has(m.id)).slice(0, 3);

    if (!eligible.length) return NextResponse.json({ bets: [], skipped: "already bet on all eligible markets" });

    const results: { marketId: number; symbol: string; amount: number; txHash: string }[] = [];

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

        results.push({ marketId: market.id, symbol: market.token_symbol, amount, txHash });
      } catch (err) {
        console.error(`Agent bet failed for market ${market.id} (${market.token_symbol}):`, toMessage(err));
      }
    }

    return NextResponse.json({ bets: results });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}

// GET returns the agent's current bet portfolio
export async function GET() {
  try {
    const agentAddress = getAgentWalletAddress().toLowerCase();
    const supabase = getSupabaseAdmin();

    const { data: bets } = await supabase
      .from("bets")
      .select("market_id, side, amount, created_at")
      .eq("wallet_address", agentAddress)
      .order("created_at", { ascending: false });

    const totalDeployed = (bets || []).reduce((s, b) => s + Number(b.amount), 0);

    return NextResponse.json({ agentAddress, bets: bets || [], totalDeployed });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
