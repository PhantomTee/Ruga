import { NextRequest, NextResponse } from "next/server";
import { getOnChainMarket } from "@/lib/chain";
import { getMarketChart } from "@/lib/coingecko";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase";

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

    if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is required for on-chain market detail");
    const onChain = await getOnChainMarket(Number(market.on_chain_id), wallet);
    const chart = market.coingecko_id ? await getMarketChart(market.coingecko_id) : null;

    return NextResponse.json({ market: { ...market, ...onChain }, bets: bets || [], chart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown market detail failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
