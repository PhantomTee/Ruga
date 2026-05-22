import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 50), 100);

    // Fetch recent bets
    const { data: bets, error: betsError } = await supabase
      .from("bets")
      .select("id, market_id, wallet_address, side, amount, created_at")
      .gte("created_at", "2020-01-01T00:00:00Z")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (betsError) throw betsError;

    if (!bets || bets.length === 0) {
      return NextResponse.json(
        { activity: [] },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }

    // Fetch market symbols for those market IDs
    const marketIds = [...new Set(bets.map((b) => b.market_id))];
    const { data: markets, error: marketsError } = await supabase
      .from("markets")
      .select("id, token_symbol, token_name")
      .in("id", marketIds);
    if (marketsError) throw marketsError;

    const marketMap = new Map((markets || []).map((m) => [m.id, m]));

    const activity = bets.map((b) => {
      const m = marketMap.get(b.market_id);
      return {
        id: b.id,
        market_id: b.market_id,
        wallet_address: b.wallet_address,
        side: b.side,
        amount: b.amount,
        created_at: b.created_at,
        token_symbol: m?.token_symbol || "UNKNOWN",
        token_name: m?.token_name || null,
      };
    });

    return NextResponse.json(
      { activity },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
