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

    const lastScan = commits.sort((a, b) => Date.parse(b.processed_at) - Date.parse(a.processed_at))[0];
    const signals = commits.filter((commit) => ["signal_found", "market_created"].includes(commit.status)).length;
    const failures = commits.filter((commit) => commit.status === "failed").length;
    const ruggedResolved = resolved.filter((market) => market.outcome === true).length;
    const accuracyRate = resolved.length ? Math.round((ruggedResolved / resolved.length) * 100) : 0;

    return NextResponse.json({
      lastScanTime: lastScan?.processed_at || null,
      nextScanTime: lastScan ? new Date(Date.parse(lastScan.processed_at) + 5 * 60 * 1000).toISOString() : null,
      commitsScannedToday: commits.length,
      signalsFound: signals,
      failures,
      marketsCreated: markets.length,
      accuracyRate,
      reasoningLogs: markets
        .filter((market) => market.groq_reasoning)
        .slice(0, 20)
        .map((market) => ({
          token: market.token_symbol,
          confidence: market.groq_confidence,
          reasoning: market.groq_reasoning,
          createdAt: market.created_at
        }))
    });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
