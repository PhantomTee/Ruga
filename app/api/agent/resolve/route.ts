import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agent-auth";
import { resolveOnChainMarket } from "@/lib/chain";
import { getUsdPrice, scaleUsd } from "@/lib/coingecko";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveExpiredMarkets(request: NextRequest) {
  try {
    assertAgentAuthorized(request);
    const supabase = getSupabaseAdmin();
    const { data: markets, error } = await supabase
      .from("markets")
      .select("*")
      .lt("resolves_at", new Date().toISOString())
      .eq("resolved", false);
    if (error) throw error;

    const resolved: number[] = [];

    for (const market of markets || []) {
      if (!market.coingecko_id || !market.price_at_creation) continue;
      // Throttle CoinGecko calls — free tier allows ~5 req/min
      await new Promise((r) => setTimeout(r, 300));
      const currentPrice = await getUsdPrice(market.coingecko_id);
      const currentPriceScaled = scaleUsd(currentPrice);
      const startPrice = Number(market.price_at_creation);
      const priceChange = ((Number(currentPriceScaled) - startPrice) / startPrice) * 100;
      const rugged = priceChange <= -50;

      await resolveOnChainMarket(Number(market.on_chain_id), rugged);

      const { error: updateError } = await supabase
        .from("markets")
        .update({ resolved: true, final_price: currentPriceScaled.toString(), outcome: rugged })
        .eq("id", market.id);
      if (updateError) throw updateError;

      resolved.push(Number(market.id));
    }

    return NextResponse.json({ resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown resolution failure";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return resolveExpiredMarkets(request);
}

export async function GET(request: NextRequest) {
  return resolveExpiredMarkets(request);
}
