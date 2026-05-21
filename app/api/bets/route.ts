import { NextRequest, NextResponse } from "next/server";
import { parseUnits } from "ethers";
import { verifyBetTransactionDetails } from "@/lib/chain";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");
    if (!wallet) return NextResponse.json({ error: "wallet param required" }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bets")
      .select("*, markets(id, token_symbol, token_name, resolved, outcome, yes_pool, no_pool)")
      .eq("wallet_address", wallet.toLowerCase())
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ bets: data || [] });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}

// Integer microdollar arithmetic to avoid float precision loss on USDC amounts
function addUsdc(a: string | number | null, b: string): string {
  const aMicro = Math.round(Number(a || 0) * 1_000_000);
  const bMicro = Math.round(Number(b) * 1_000_000);
  const total = aMicro + bMicro;
  const whole = Math.floor(total / 1_000_000);
  const frac = total % 1_000_000;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(6, "0").replace(/0+$/, "")}`;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      marketId?: number;
      side?: "yes" | "no";
      amount?: string;
      txHash?: string;
      walletAddress?: string;
    };

    if (!body.marketId || !body.side || !body.amount || !body.txHash || !body.walletAddress) {
      return NextResponse.json({ error: "marketId, side, amount, txHash and walletAddress are required" }, { status: 400 });
    }
    if (!["yes", "no"].includes(body.side)) {
      return NextResponse.json({ error: "side must be yes or no" }, { status: 400 });
    }
    if (Number(body.amount) <= 0) {
      return NextResponse.json({ error: "amount must be greater than zero" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: market, error: marketError } = await supabase
      .from("markets")
      .select("on_chain_id,yes_pool,no_pool")
      .eq("id", body.marketId)
      .single();
    if (marketError) throw marketError;

    const parsedAmount = parseUnits(body.amount, 6);
    await verifyBetTransactionDetails({
      txHash: body.txHash,
      expectedWallet: body.walletAddress,
      marketId: Number(market.on_chain_id),
      side: body.side,
      amount: parsedAmount
    });

    const { error } = await supabase.from("bets").insert({
      market_id: body.marketId,
      wallet_address: body.walletAddress.toLowerCase(),
      side: body.side,
      amount: body.amount,
      tx_hash: body.txHash
    });
    if (error) throw error;

    const update =
      body.side === "yes"
        ? { yes_pool: addUsdc(market.yes_pool, body.amount) }
        : { no_pool: addUsdc(market.no_pool, body.amount) };
    const { error: poolError } = await supabase.from("markets").update(update).eq("id", body.marketId);
    if (poolError) throw poolError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = toMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
