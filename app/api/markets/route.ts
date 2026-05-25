import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getOnChainMarket } from "@/lib/chain";
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

// Per-process pool cache to limit RPC calls under 5-second polling pressure
let poolCache: { pools: Map<number, { yesPool: string; noPool: string }>; expiresAt: number } | null = null;

async function loadPoolsFromChain(rows: MarketRecord[]): Promise<Map<number, { yesPool: string; noPool: string }>> {
  const now = Date.now();
  if (poolCache && now < poolCache.expiresAt) return poolCache.pools;

  const settled = await Promise.allSettled(
    rows.map(async (m) => {
      const c = await getOnChainMarket(Number(m.on_chain_id));
      return { id: Number(m.id), yesPool: c.yesPool, noPool: c.noPool };
    })
  );

  const pools = new Map<number, { yesPool: string; noPool: string }>();
  for (const r of settled) {
    if (r.status === "fulfilled") pools.set(r.value.id, { yesPool: r.value.yesPool, noPool: r.value.noPool });
  }

  if (pools.size > 0) poolCache = { pools, expiresAt: now + 10_000 };
  return pools;
}

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

    // Overlay on-chain pool values so the list always shows accurate pool bars.
    // Falls back to Supabase yes_pool/no_pool if the RPC call fails.
    const chainPools = await loadPoolsFromChain(rows).catch(() => new Map<number, { yesPool: string; noPool: string }>());

    return NextResponse.json(
      {
        markets: rows.map((market) => ({
          ...market,
          display_id: displayIds.get(String(market.id)) ?? null,
          ...chainPools.get(Number(market.id)),
        })),
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
