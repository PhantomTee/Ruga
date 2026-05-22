import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [commitsResult, marketsResult] = await Promise.all([
      supabase
      .from("commits_processed")
      .select("*")
      .order("processed_at", { ascending: false })
        .limit(50),
      supabase
        .from("markets")
        .select("id,token_symbol,commit_message,created_at")
        .gte("created_at", "2020-01-01T00:00:00Z")
        .order("created_at", { ascending: false })
        .limit(50)
    ]);
    if (commitsResult.error) throw commitsResult.error;
    if (marketsResult.error) throw marketsResult.error;

    const commits = commitsResult.data || [];
    const marketEvents = (marketsResult.data || []).map((market) => ({
      sha: `market-${market.id}`,
      commit_message: market.commit_message || `Market created for ${market.token_symbol}`,
      tokens_found: [market.token_symbol],
      status: "market_created",
      processed_at: market.created_at,
      market_id: market.id
    }));
    const feed = [...commits, ...marketEvents]
      .sort((a, b) => Date.parse(b.processed_at) - Date.parse(a.processed_at))
      .slice(0, 50);

    return NextResponse.json(
      { feed },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
