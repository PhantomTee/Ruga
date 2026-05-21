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
    const signalCount = commits.filter((commit) => ["signal_found", "market_created"].includes(commit.status)).length;
    const createdCount = commits.filter((commit) => commit.status === "market_created").length;
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

    const lastScan = commits.sort((a, b) => Date.parse(b.processed_at) - Date.parse(a.processed_at))[0];
    return NextResponse.json({
      lastScanTime: lastScan?.processed_at || null,
      nextScanTime: lastScan ? new Date(Date.parse(lastScan.processed_at) + 5 * 60 * 1000).toISOString() : null,
      commitsScannedToday: commits.length,
      signalsFoundToday: signalCount,
      marketsCreatedToday: createdCount || markets.length,
      resolvedMarkets: resolvedCount,
      ruggedResolvedMarkets: ruggedCount,
      accuracyRate: resolvedCount > 0 ? Math.round((ruggedCount / resolvedCount) * 10000) / 100 : null,
      recentGroqLogs
    });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
