import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const [commitsResult, marketsResult, resolvedResult] = await Promise.all([
      supabase.from("commits_processed").select("*").gte("processed_at", since.toISOString()),
      supabase.from("markets").select("*").gte("created_at", since.toISOString()),
      supabase.from("markets").select("*").eq("resolved", true)
    ]);
    if (commitsResult.error) throw commitsResult.error;
    if (marketsResult.error) throw marketsResult.error;
    if (resolvedResult.error) throw resolvedResult.error;

    const commits = commitsResult.data || [];
    const markets = marketsResult.data || [];
    const resolved = resolvedResult.data || [];

    const resolvedCount = resolved.length;
    const ruggedCount = resolved.filter((market) => market.outcome === true).length;
    const signalCount =
      commits.filter((commit) => ["signal_found", "market_created"].includes(commit.status)).length +
      markets.filter((market) => !market.commit_sha).length;
    const recentGroqLogs = [...markets]
      .filter((market) => market.groq_reasoning)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 10)
      .map((market) => ({
        marketId: market.id,
        tokenSymbol: market.token_symbol,
        reasoning: market.groq_reasoning,
        confidenceScore: market.groq_confidence,
        createdAt: market.created_at
      }));

    const lastCommit = [...commits].sort((a, b) => Date.parse(b.processed_at) - Date.parse(a.processed_at))[0];
    const lastMarket = [...markets].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    const lastActivityTime = [lastCommit?.processed_at, lastMarket?.created_at]
      .filter(Boolean)
      .sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] as string | undefined;
    return NextResponse.json({
      lastScanTime: lastActivityTime || null,
      nextScanTime: lastActivityTime ? new Date(Date.parse(lastActivityTime) + 5 * 60 * 1000).toISOString() : null,
      commitsScannedToday: commits.length,
      signalsFoundToday: signalCount,
      marketsCreatedToday: markets.length,
      resolvedMarkets: resolvedCount,
      ruggedResolvedMarkets: ruggedCount,
      accuracyRate: resolvedCount > 0 ? Math.round((ruggedCount / resolvedCount) * 10000) / 100 : null,
      recentGroqLogs
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
