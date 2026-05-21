import { NextRequest, NextResponse } from "next/server";
import { lookupCoin } from "@/lib/coingecko";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

type DexPair = {
  chainId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  fdv?: number;
};

function parseDexInput(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.hostname === "dexscreener.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return parts[parts.length - 1]; // token or pair address
    }
  } catch { /* not a URL */ }

  // Raw address — Ethereum (0x...) or Solana (base58)
  const cleaned = input.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(cleaned)) return cleaned;
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleaned)) return cleaned;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("url") || "";
    if (!raw) return NextResponse.json({ error: "url param required" }, { status: 400 });

    const address = parseDexInput(raw);
    if (!address) {
      return NextResponse.json(
        { error: "Paste a DexScreener link or a token contract address" },
        { status: 400 }
      );
    }

    // Fetch from DexScreener
    const resp = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) }
    );
    if (!resp.ok) {
      return NextResponse.json({ error: "DexScreener returned no data for this address" }, { status: 404 });
    }

    const data = await resp.json() as { pairs?: DexPair[] };
    const pairs = (data.pairs || []).filter(
      (p) => Number(p.priceUsd) > 0 && (p.liquidity?.usd ?? 0) > 100
    );

    if (!pairs.length) {
      return NextResponse.json(
        { error: "No active trading pairs found for this token on DexScreener" },
        { status: 404 }
      );
    }

    // Pick the most liquid pair
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const symbol = best.baseToken.symbol.toUpperCase();
    const name = best.baseToken.name || symbol;
    const priceUsd = Number(best.priceUsd);
    const liquidity = best.liquidity?.usd ?? 0;
    const volume24h = best.volume?.h24 ?? 0;
    const chain = best.chainId;
    const pairAddress = best.pairAddress;

    // Check if a market already exists
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from("markets")
      .select("id")
      .eq("token_symbol", symbol)
      .gte("created_at", "2020-01-01T00:00:00Z")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ exists: true, marketId: existing.id, symbol, name });
    }

    // Try CoinGecko for a stable coinId (needed for price chart)
    let coinId: string | null = null;
    try {
      const cg = await lookupCoin(symbol);
      if (cg) coinId = cg.id;
    } catch { /* not on CoinGecko — that's fine */ }

    return NextResponse.json({
      exists: false,
      symbol,
      name,
      priceUsd,
      liquidity,
      volume24h,
      chain,
      pairAddress,
      tokenAddress: address,
      coinId,
    });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
