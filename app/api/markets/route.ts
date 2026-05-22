import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MarketRecord } from "@/lib/constants";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

const MARKET_LIST_COLUMNS = [
  "id",
  "on_chain_id",
  "token_symbol",
  "token_name",
  "coingecko_id",
  "commit_sha",
  "commit_message",
  "groq_reasoning",
  "groq_confidence",
  "price_at_creation",
  "yes_pool",
  "no_pool",
  "created_at",
  "resolves_at",
  "resolved",
  "outcome",
  "final_price"
].join(",");

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    // Use a date floor so the query never does an unrestricted full table scan —
    // Supabase RLS can block unfiltered SELECTs even for the service role in some configs.
    const { data, error } = await supabase
      .from("markets")
      .select(MARKET_LIST_COLUMNS)
      .gte("created_at", "2020-01-01T00:00:00Z")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as unknown as MarketRecord[];
    const displayIds = new Map(
      [...rows]
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || Number(a.id) - Number(b.id))
        .map((market, index) => [String(market.id), index + 1])
    );

    return NextResponse.json(
      { markets: rows.map((market) => ({ ...market, display_id: displayIds.get(String(market.id)) ?? null })) },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
