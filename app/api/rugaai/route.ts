import { NextResponse } from "next/server";
import { getAgentWalletAddress } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const agentAddress = getAgentWalletAddress().toLowerCase();

    // High-confidence active markets only — the AI's strict criteria
    const { data: markets, error } = await supabase
      .from("markets")
      .select(
        "id, on_chain_id, token_symbol, token_name, groq_confidence, groq_reasoning, yes_pool, no_pool, resolves_at, resolved, outcome, created_at"
      )
      .eq("resolved", false)
      .gte("groq_confidence", 70)
      .order("groq_confidence", { ascending: false });
    if (error) throw error;

    if (!markets?.length) return NextResponse.json({ picks: [], agentAddress });

    // Agent's bets on these markets
    const marketIds = markets.map((m) => m.id);
    const { data: agentBets } = await supabase
      .from("bets")
      .select("market_id, side, amount, created_at")
      .eq("wallet_address", agentAddress)
      .in("market_id", marketIds);

    const betMap = new Map((agentBets || []).map((b) => [b.market_id, b]));

    // Agent totals
    const { data: allAgentBets } = await supabase
      .from("bets")
      .select("amount")
      .eq("wallet_address", agentAddress);
    const totalDeployed = (allAgentBets || []).reduce((s, b) => s + Number(b.amount), 0);

    const picks = markets.map((market) => ({
      ...market,
      agentBet: betMap.get(market.id) ?? null,
    }));

    return NextResponse.json({ picks, agentAddress, totalDeployed });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
