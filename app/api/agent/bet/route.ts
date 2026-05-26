import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agent-auth";
import { getAgentWalletAddress } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";
import { placeAgentBets } from "@/lib/place-agent-bets";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    assertAgentAuthorized(request);
    const result = await placeAgentBets();
    return NextResponse.json(result);
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
