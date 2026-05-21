import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // Fetch all bets for this wallet
    const { data: bets, error: betsError } = await supabase
      .from("bets")
      .select("*")
      .eq("wallet_address", wallet)
      .gte("created_at", "2020-01-01T00:00:00Z")
      .order("created_at", { ascending: false });
    if (betsError) throw betsError;

    if (!bets || bets.length === 0) {
      return NextResponse.json({ bets: [], markets: {} });
    }

    // Fetch market details for those market IDs
    const marketIds = [...new Set(bets.map((b) => b.market_id))];
    const { data: markets, error: marketsError } = await supabase
      .from("markets")
      .select("id, token_symbol, token_name, resolved, outcome, yes_pool, no_pool, resolves_at, price_at_creation")
      .in("id", marketIds);
    if (marketsError) throw marketsError;

    const marketsMap = Object.fromEntries((markets || []).map((m) => [m.id, m]));

    return NextResponse.json({ bets, markets: marketsMap });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
