import { NextRequest, NextResponse } from "next/server";
import { getOnChainMarket } from "@/lib/chain";
import { getMarketChart, getDexChartData } from "@/lib/coingecko";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet") || undefined;
    const supabase = getSupabaseAdmin();
    const { data: market, error } = await supabase.from("markets").select("*").eq("id", params.id).single();
    if (error) throw error;

    const { data: bets, error: betsError } = await supabase
      .from("bets")
      .select("*")
      .eq("market_id", params.id)
      .order("created_at", { ascending: false });
    if (betsError) throw betsError;

    const { data: marketOrder, error: orderError } = await supabase
      .from("markets")
      .select("id,created_at")
      .gte("created_at", "2020-01-01T00:00:00Z")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (orderError) throw orderError;
    const displayId = (marketOrder || []).findIndex((row) => String(row.id) === String(market.id)) + 1;

    if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is required for on-chain market detail");
    const onChain = await getOnChainMarket(Number(market.on_chain_id), wallet);

    // Try CoinGecko chart first; fall back to DexScreener approximation
    let chart: { prices: Array<[number, number]> } | null = null;
    if (market.coingecko_id) {
      chart = await getMarketChart(market.coingecko_id).catch(() => null);
    }
    // If no CoinGecko data, try DexScreener by searching the symbol
    if (!chart) {
      const { lookupPriceFromDex } = await import("@/lib/coingecko");
      const dex = await lookupPriceFromDex(market.token_symbol).catch(() => null);
      if (dex && dex.price > 0) {
        // Build a minimal 2-point chart from current price + creation price
        const now = Date.now();
        const priceAtCreation = Number(market.price_at_creation || 0) / 100_000_000;
        const points: Array<[number, number]> = [];
        if (market.created_at) points.push([new Date(market.created_at).getTime(), priceAtCreation]);
        points.push([now, dex.price]);
        if (points.length >= 2) chart = { prices: points };
      }
    }

    return NextResponse.json(
      { market: { ...market, ...onChain, display_id: displayId || null }, bets: bets || [], chart },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
