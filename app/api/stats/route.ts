import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [marketsResult, betsResult] = await Promise.all([
      supabase.from("markets").select("yes_pool,no_pool").gte("created_at", "2020-01-01T00:00:00Z"),
      supabase.from("bets").select("wallet_address,amount").gte("created_at", "2020-01-01T00:00:00Z")
    ]);

    if (marketsResult.error) throw marketsResult.error;
    if (betsResult.error) throw betsResult.error;

    const markets = marketsResult.data || [];
    const bets = betsResult.data || [];

    const totalWagered = markets.reduce((sum, m) => {
      return sum + Number(m.yes_pool || 0) + Number(m.no_pool || 0);
    }, 0);

    const uniqueBettors = new Set(bets.map((b) => b.wallet_address.toLowerCase())).size;
    const totalBets = bets.length;

    return NextResponse.json({
      totalMarkets: markets.length,
      totalWagered: Math.round(totalWagered * 100) / 100,
      uniqueBettors,
      totalBets,
    });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
