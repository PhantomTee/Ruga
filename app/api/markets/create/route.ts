import { NextRequest, NextResponse } from "next/server";
import { assertAgentAuthorized } from "@/lib/agent-auth";
import { createOnChainMarket } from "@/lib/chain";
import { getUsdPrice, lookupCoin, lookupPriceFromDex, scaleUsd } from "@/lib/coingecko";
import { validateMultiSourceSignal } from "@/lib/groq";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertAgentAuthorized(request);
    const body = await request.json() as { symbol?: string };
    const symbol = (body.symbol ?? "").toUpperCase().trim();

    if (!symbol || symbol.length < 2 || symbol.length > 12) {
      return NextResponse.json({ error: "Symbol must be 2–12 characters" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // If a market already exists, return its ID immediately
    const { data: existing } = await supabase
      .from("markets")
      .select("id")
      .eq("token_symbol", symbol)
      .gte("created_at", "2020-01-01T00:00:00Z")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ exists: true, marketId: existing.id });
    }
    const lock = await supabase.from("market_creation_locks").insert({ token_symbol: symbol });
    if (lock.error) {
      if (lock.error.code === "23505") {
        return NextResponse.json({ error: `A market for ${symbol} is already being created` }, { status: 409 });
      }
      throw lock.error;
    }

    // Resolve price — CoinGecko first, DexScreener as fallback
    let priceScaled: bigint;
    let coinId: string | null = null;
    let coinName: string = symbol;

    try {
      const coin = await lookupCoin(symbol);
      if (coin) {
        const price = await getUsdPrice(coin.id);
        priceScaled = scaleUsd(price);
        coinId = coin.id;
        coinName = coin.name;
      } else {
        const dex = await lookupPriceFromDex(symbol).catch(() => null);
        if (!dex || dex.price <= 0) {
          return NextResponse.json(
            { error: `No price data found for ${symbol}. Check the symbol and try again.` },
            { status: 404 }
          );
        }
        priceScaled = scaleUsd(dex.price);
        coinName = dex.name;
      }
    } catch (e) {
      return NextResponse.json({ error: `Price lookup failed: ${toMessage(e)}` }, { status: 502 });
    }

    // Get AI reasoning — never gate on it for user-submitted markets
    const verdict = await validateMultiSourceSignal({
      symbol,
      sources: ["user-submitted"],
      reasons: [`User-submitted token flagged for potential rug pull`],
    }).catch(() => null);

    // Create on-chain market
    let chainMarket: Awaited<ReturnType<typeof createOnChainMarket>>;
    try {
      chainMarket = await createOnChainMarket({
        symbol,
        name: coinName,
        coingeckoId: coinId ?? symbol,
        priceScaled: priceScaled!,
      });
    } catch (error) {
      await supabase.from("market_creation_locks").delete().eq("token_symbol", symbol);
      throw error;
    }

    const resolvesAt =
      chainMarket.resolvesAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const row = {
      id: chainMarket.marketId,
      on_chain_id: chainMarket.marketId,
      token_symbol: symbol,
      token_name: coinName,
      coingecko_id: coinId,
      commit_sha: null,
      commit_message: "User-submitted market",
      groq_reasoning: verdict?.reasoning ?? "Manually flagged by a community member as a potential rug pull.",
      groq_confidence: verdict?.confidenceScore ?? 50,
      price_at_creation: priceScaled!.toString(),
      created_at: new Date().toISOString(),
      resolves_at: resolvesAt,
      resolved: false,
    };

    let { error } = await supabase.from("markets").insert(row);
    if (error) {
      await new Promise((r) => setTimeout(r, 1_000));
      ({ error } = await supabase.from("markets").insert(row));
    }
    if (error) throw new Error(`DB insert failed: ${toMessage(error)}`);

    return NextResponse.json({ created: true, marketId: chainMarket.marketId });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
