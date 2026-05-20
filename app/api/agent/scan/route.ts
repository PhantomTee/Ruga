import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agent-auth";
import { createOnChainMarket } from "@/lib/chain";
import { getUsdPrice, lookupCoin, scaleUsd } from "@/lib/coingecko";
import { fetchCommitDetail, fetchCommits, extractBlacklistSymbols, extractPatch } from "@/lib/github";
import { validateRugSignal } from "@/lib/groq";
import type { CommitStatus } from "@/lib/agent-status";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function scan(request: NextRequest) {
  try {
    assertAgentAuthorized(request);
    const supabase = getSupabaseAdmin();
    const commits = await fetchCommits();
    const tokensScanned: string[] = [];
    let marketsCreated = 0;

    for (const commit of commits) {
      const { data: claim, error: claimError } = await supabase
        .from("commits_processed")
        .upsert(
          {
            sha: commit.sha,
            commit_message: commit.commit.message,
            tokens_found: [],
            status: "processing",
            error_message: null,
            processed_at: new Date().toISOString()
          },
          { onConflict: "sha", ignoreDuplicates: true }
        )
        .select("sha,status")
        .limit(1);
      if (claimError) throw claimError;
      if (!claim?.[0] || claim[0].status !== "processing") continue;

      try {
        const detail = await fetchCommitDetail(commit.sha);
        const diff = extractPatch(detail);
        const symbols = extractBlacklistSymbols(diff);
        tokensScanned.push(...symbols);

        let status: CommitStatus = symbols.length > 0 ? "signal_found" : "ignored";

        for (const symbol of symbols) {
          const { data: existing, error: existingError } = await supabase
            .from("markets")
            .select("id")
            .eq("token_symbol", symbol)
            .maybeSingle();
          if (existingError) throw existingError;
          if (existing) continue;

          const coin = await lookupCoin(symbol);
          if (!coin) continue;

          const price = await getUsdPrice(coin.id);
          const priceScaled = scaleUsd(price);
          const verdict = await validateRugSignal({
            symbol,
            message: commit.commit.message,
            diff
          }).catch(() => null);

          if (!verdict || !verdict.legitimate || verdict.confidenceScore <= 70) continue;

          const chainMarket = await createOnChainMarket({
            symbol,
            name: coin.name,
            coingeckoId: coin.id,
            priceScaled
          });

          const createdAt = new Date().toISOString();
          const resolvesAt =
            chainMarket.resolvesAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          const marketRow = {
            id: chainMarket.marketId,
            on_chain_id: chainMarket.marketId,
            token_symbol: symbol,
            token_name: coin.name,
            coingecko_id: coin.id,
            commit_sha: commit.sha,
            commit_message: commit.commit.message,
            groq_reasoning: verdict.reasoning,
            groq_confidence: verdict.confidenceScore,
            price_at_creation: priceScaled.toString(),
            created_at: createdAt,
            resolves_at: resolvesAt,
            resolved: false
          };
          let { error: insertError } = await supabase.from("markets").insert(marketRow);
          if (insertError) {
            // Retry once — on-chain market already exists so losing the DB record would orphan it
            await new Promise((r) => setTimeout(r, 1000));
            ({ error: insertError } = await supabase.from("markets").insert(marketRow));
          }
          if (insertError) throw new Error(`On-chain market ${chainMarket.marketId} created but DB insert failed: ${insertError.message}`);

          marketsCreated += 1;
          status = "market_created";
        }

        const { error: commitUpdateError } = await supabase
          .from("commits_processed")
          .update({
            commit_message: commit.commit.message,
            tokens_found: symbols,
            status,
            error_message: null,
            processed_at: new Date().toISOString()
          })
          .eq("sha", commit.sha);
        if (commitUpdateError) throw commitUpdateError;
      } catch (commitError) {
        const message = commitError instanceof Error ? commitError.message : "Unknown commit processing failure";
        await supabase
          .from("commits_processed")
          .update({
            commit_message: commit.commit.message,
            status: "failed",
            error_message: message,
            processed_at: new Date().toISOString()
          })
          .eq("sha", commit.sha);
        // Don't re-throw — record the failure and continue processing remaining commits
      }
    }

    return NextResponse.json({ marketsCreated, tokensScanned: [...new Set(tokensScanned)] });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return scan(request);
}

export async function GET(request: NextRequest) {
  return scan(request);
}
