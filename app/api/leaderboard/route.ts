import { NextResponse } from "next/server";
import { formatUnits, parseUnits } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

function usdc(value: string | number | null | undefined) {
  return parseUnits(String(value ?? "0"), 6);
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: bets, error } = await supabase.from("bets").select("wallet_address,amount,side,market_id").gte("created_at", "2020-01-01T00:00:00Z");
    if (error) throw error;

    const { data: markets, error: marketError } = await supabase
      .from("markets")
      .select("id,resolved,outcome,yes_pool,no_pool")
      .gte("created_at", "2020-01-01T00:00:00Z");
    if (marketError) throw marketError;

    const marketMap = new Map((markets || []).map((market) => [String(market.id), market]));
    const volumes = new Map<string, bigint>();
    const winnings = new Map<string, bigint>();

    for (const bet of bets || []) {
      const stake = usdc(bet.amount);
      // Volume: every bet counts regardless of outcome
      volumes.set(bet.wallet_address, (volumes.get(bet.wallet_address) || 0n) + stake);

      // Winnings: only resolved winning bets
      const market = marketMap.get(String(bet.market_id));
      if (!market?.resolved) continue;
      const winningSide = market.outcome ? "yes" : "no";
      if (bet.side === winningSide) {
        const winningPool = usdc(market.outcome ? market.yes_pool : market.no_pool);
        const losingPool = usdc(market.outcome ? market.no_pool : market.yes_pool);
        const grossProfit = winningPool > 0n ? (losingPool * stake) / winningPool : 0n;
        const fee = (grossProfit * 200n) / 10_000n;
        winnings.set(bet.wallet_address, (winnings.get(bet.wallet_address) || 0n) + stake + grossProfit - fee);
      }
    }

    // Rank by volume (all wallets that bet), include winnings alongside
    const leaderboard = [...volumes.entries()]
      .map(([wallet, vol]) => ({
        wallet,
        volume: Number(formatUnits(vol, 6)),
        won: Number(formatUnits(winnings.get(wallet) || 0n, 6)),
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    return NextResponse.json({ leaderboard });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
