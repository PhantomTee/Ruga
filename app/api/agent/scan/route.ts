import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agent-auth";
import { createOnChainMarket } from "@/lib/chain";
import { getUsdPrice, lookupCoin, scaleUsd } from "@/lib/coingecko";
import { fetchCommitDetail, fetchCommits, extractBlacklistSymbols, extractPatch } from "@/lib/github";
import { validateRugSignal, validateMultiSourceSignal } from "@/lib/groq";
import { gatherExternalSignals } from "@/lib/signals";
import type { AggregatedSignal } from "@/lib/signals";
import { fetchDexScreenerNewListings } from "@/lib/signals/dexscreener";
import type { CommitStatus } from "@/lib/agent-status";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

const COMMUNITY_REPOS = ["freqtrade/freqtrade-strategies"];

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function scan(request: NextRequest) {
  try {
    assertAgentAuthorized(request);
    const supabase = getSupabaseAdmin();

    const tokensScanned: string[] = [];
    let marketsCreated = 0;

    // ─── 1. NFI + community blacklist repos (GitHub) ─────────────────────────
    const allRepoCommits: Array<{ sha: string; message: string }> = [];

    const nfiCommits = await fetchCommits().catch(() => []);
    for (const c of nfiCommits) {
      allRepoCommits.push({ sha: c.sha, message: c.commit.message });
    }

    for (const repo of COMMUNITY_REPOS) {
      try {
        const resp = await fetch(
          `https://api.github.com/repos/${repo}/commits?per_page=20`,
          {
            headers: {
              accept: "application/vnd.github.v3+json",
              authorization: `Bearer ${process.env.GITHUB_TOKEN || process.env.GH_PAT}`
            },
            next: { revalidate: 0 }
          }
        );
        if (resp.ok) {
          const commits = await resp.json() as Array<{ sha: string; commit: { message: string } }>;
          for (const c of commits) allRepoCommits.push({ sha: c.sha, message: c.commit.message });
        }
      } catch { /* skip */ }
    }

    for (const { sha, message } of allRepoCommits) {
      const { data: claim, error: claimError } = await supabase
        .from("commits_processed")
        .upsert(
          { sha, commit_message: message, tokens_found: [], status: "processing", error_message: null, processed_at: new Date().toISOString() },
          { onConflict: "sha", ignoreDuplicates: true }
        )
        .select("sha,status")
        .limit(1);
      if (claimError) throw claimError;
      if (!claim?.[0] || claim[0].status !== "processing") continue;

      try {
        const detail = await fetchCommitDetail(sha);
        const diff = extractPatch(detail);
        const symbols = extractBlacklistSymbols(diff);
        tokensScanned.push(...symbols);

        let status: CommitStatus = symbols.length > 0 ? "signal_found" : "ignored";

        for (const symbol of symbols) {
          const { data: existing } = await supabase.from("markets").select("id").eq("token_symbol", symbol).maybeSingle();
          if (existing) continue;

          const coin = await lookupCoin(symbol);
          if (!coin) continue;

          const price = await getUsdPrice(coin.id);
          const priceScaled = scaleUsd(price);

          const verdict = await validateRugSignal({ symbol, message, diff }).catch(() => null);
          if (!verdict || !verdict.legitimate || verdict.confidenceScore <= 70) continue;

          const created = await createAndInsertMarket(supabase, {
            symbol, coinId: coin.id, coinName: coin.name, priceScaled,
            reasoning: verdict.reasoning, confidence: verdict.confidenceScore,
            commitSha: sha, commitMessage: message
          });
          if (created) { marketsCreated++; status = "market_created"; }
        }

        await supabase.from("commits_processed")
          .update({ commit_message: message, tokens_found: symbols, status, error_message: null, processed_at: new Date().toISOString() })
          .eq("sha", sha);

      } catch (err) {
        await supabase.from("commits_processed")
          .update({ commit_message: message, status: "failed", error_message: toMessage(err), processed_at: new Date().toISOString() })
          .eq("sha", sha);
      }
    }

    // ─── 2. External sources: RugCheck, DexScreener, GoPlusSecurity ──────────
    const externalSignals: AggregatedSignal[] = await gatherExternalSignals().catch(() => []);

    for (const signal of externalSignals) {
      try {
        tokensScanned.push(signal.symbol);

        const { data: existing } = await supabase.from("markets").select("id").eq("token_symbol", signal.symbol).maybeSingle();
        if (existing) continue;

        const coin = await lookupCoin(signal.symbol);
        if (!coin) continue;

        const price = await getUsdPrice(coin.id);
        const priceScaled = scaleUsd(price);

        const minConfidence = signal.sources.length >= 2 ? 55 : 70;
        const verdict = await validateMultiSourceSignal({ symbol: signal.symbol, sources: signal.sources, reasons: signal.reasons }).catch(() => null);
        if (!verdict || !verdict.legitimate || verdict.confidenceScore < minConfidence) continue;

        const created = await createAndInsertMarket(supabase, {
          symbol: signal.symbol, coinId: coin.id, coinName: coin.name, priceScaled,
          reasoning: verdict.reasoning, confidence: verdict.confidenceScore,
          commitSha: null, commitMessage: signal.reasons[0] ?? ""
        });
        if (created) marketsCreated++;

      } catch (err) {
        console.error(`External signal failed for ${signal.symbol}:`, toMessage(err));
      }
    }

    // ─── 3. Proactive new listings from DexScreener ──────────────────────────
    const newListings = await fetchDexScreenerNewListings().catch(() => []);
    let proactiveCreated = 0;

    for (const listing of newListings) {
      if (proactiveCreated >= 2) break;
      try {
        tokensScanned.push(listing.symbol);

        const { data: existing } = await supabase.from("markets").select("id").eq("token_symbol", listing.symbol).maybeSingle();
        if (existing) continue;

        const coin = await lookupCoin(listing.symbol).catch(() => null);
        const priceUsd = coin ? await getUsdPrice(coin.id).catch(() => listing.priceUsd) : listing.priceUsd;
        if (priceUsd <= 0) continue;
        const priceScaled = scaleUsd(priceUsd);

        const verdict = await validateMultiSourceSignal({
          symbol: listing.symbol,
          sources: ["dexscreener"],
          reasons: [listing.reason]
        }).catch(() => null);
        if (!verdict || !verdict.legitimate || verdict.confidenceScore < 45) continue;

        const created = await createAndInsertMarket(supabase, {
          symbol: listing.symbol, coinId: coin?.id ?? null, coinName: coin?.name ?? listing.name,
          priceScaled, reasoning: verdict.reasoning, confidence: verdict.confidenceScore,
          commitSha: null, commitMessage: listing.reason
        });
        if (created) { marketsCreated++; proactiveCreated++; }

      } catch (err) {
        console.error(`Proactive listing failed for ${listing.symbol}:`, toMessage(err));
      }
    }

    return NextResponse.json({ marketsCreated, tokensScanned: [...new Set(tokensScanned)] });

  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}

async function createAndInsertMarket(
  supabase: ReturnType<typeof import("@/lib/supabase").getSupabaseAdmin>,
  opts: {
    symbol: string;
    coinId: string | null;
    coinName: string;
    priceScaled: bigint;
    reasoning: string;
    confidence: number;
    commitSha: string | null;
    commitMessage: string;
  }
): Promise<boolean> {
  const chainMarket = await createOnChainMarket({
    symbol: opts.symbol,
    name: opts.coinName,
    coingeckoId: opts.coinId ?? opts.symbol,
    priceScaled: opts.priceScaled
  });

  const createdAt = new Date().toISOString();
  const resolvesAt = chainMarket.resolvesAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const row = {
    id: chainMarket.marketId,
    on_chain_id: chainMarket.marketId,
    token_symbol: opts.symbol,
    token_name: opts.coinName,
    coingecko_id: opts.coinId,
    commit_sha: opts.commitSha,
    commit_message: opts.commitMessage,
    groq_reasoning: opts.reasoning,
    groq_confidence: opts.confidence,
    price_at_creation: opts.priceScaled.toString(),
    created_at: createdAt,
    resolves_at: resolvesAt,
    resolved: false
  };

  let { error } = await supabase.from("markets").insert(row);
  if (error) {
    await new Promise((r) => setTimeout(r, 1_000));
    ({ error } = await supabase.from("markets").insert(row));
  }
  if (error) throw new Error(`DB insert failed for ${opts.symbol}: ${toMessage(error)}`);
  return true;
}

export async function POST(request: NextRequest) { return scan(request); }
export async function GET(request: NextRequest) { return scan(request); }
