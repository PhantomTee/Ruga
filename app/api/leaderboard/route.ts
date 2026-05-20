import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: bets, error } = await supabase.from("bets").select("wallet_address,amount,side,market_id");
    if (error) throw error;

    const { data: markets, error: marketError } = await supabase
      .from("markets")
      .select("id,resolved,outcome,yes_pool,no_pool");
    if (marketError) throw marketError;

    const marketMap = new Map((markets || []).map((market) => [String(market.id), market]));
    const totals = new Map<string, number>();

    for (const bet of bets || []) {
      const market = marketMap.get(String(bet.market_id));
      if (!market?.resolved) continue;
      const winningSide = market.outcome ? "yes" : "no";
      if (bet.side === winningSide) {
        const winningPool = Number(market.outcome ? market.yes_pool : market.no_pool);
        const losingPool = Number(market.outcome ? market.no_pool : market.yes_pool);
        const stake = Number(bet.amount);
        const grossProfit = winningPool > 0 ? (losingPool * stake) / winningPool : 0;
        const fee = grossProfit * 0.02;
        totals.set(bet.wallet_address, (totals.get(bet.wallet_address) || 0) + stake + grossProfit - fee);
      }
    }

    const leaderboard = [...totals.entries()]
      .map(([wallet, won]) => ({ wallet, won }))
      .sort((a, b) => b.won - a.won)
      .slice(0, 10);

    return NextResponse.json({ leaderboard });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
