import { NextRequest, NextResponse } from "next/server";
import { Interface } from "ethers";
import { RUGA_MARKET_ABI } from "@/lib/abi";
import { getProvider } from "@/lib/chain";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/supabase";
import { toMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      txHash: string;
      walletAddress: string;
      symbol: string;
      name: string;
      coinId: string | null;
      priceScaled: string;
      pairAddress?: string;
      chain?: string;
    };

    const { txHash, walletAddress, symbol, name, coinId, priceScaled } = body;
    if (!txHash || !walletAddress || !symbol) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the TX on Arc
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return NextResponse.json({ error: "Transaction not found or failed on-chain" }, { status: 400 });
    }
    if (receipt.from.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "Transaction sender mismatch" }, { status: 400 });
    }
    if (!CONTRACT_ADDRESS || receipt.to?.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: "Transaction did not target the Ruga contract" }, { status: 400 });
    }
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return NextResponse.json({ error: "Transaction details were not found on Arc" }, { status: 400 });
    }

    // Parse MarketCreated event from receipt
    const iface = new Interface(RUGA_MARKET_ABI);
    const parsedTx = iface.parseTransaction({ data: tx.data, value: tx.value });
    if (!parsedTx || parsedTx.name !== "createMarket") {
      return NextResponse.json({ error: "Transaction did not call createMarket" }, { status: 400 });
    }
    if (
      String(parsedTx.args.tokenSymbol ?? parsedTx.args[0]).toUpperCase() !== symbol.toUpperCase() ||
      String(parsedTx.args.currentPrice ?? parsedTx.args[3]) !== String(priceScaled)
    ) {
      return NextResponse.json({ error: "Transaction market details do not match request body" }, { status: 400 });
    }

    let marketId: number | null = null;
    let resolvesAt: string | null = null;

    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "MarketCreated") {
          marketId = Number(parsed.args.id);
          resolvesAt = new Date(Number(parsed.args.resolvesAt) * 1000).toISOString();
          break;
        }
      } catch { /* non-market log */ }
    }

    // Fallback: read marketCount if event not found
    if (marketId === null) {
      const { getReadContract } = await import("@/lib/chain");
      const contract = getReadContract();
      marketId = Number(await contract.marketCount());
    }

    if (marketId === null) {
      return NextResponse.json({ error: "Could not determine market ID from transaction" }, { status: 500 });
    }

    // Check if already registered (idempotent)
    const { data: already } = await supabase
      .from("markets")
      .select("id")
      .eq("id", marketId)
      .maybeSingle();
    if (already) {
      return NextResponse.json({ marketId, alreadyRegistered: true });
    }

    const now = new Date().toISOString();
    const row = {
      id: marketId,
      on_chain_id: marketId,
      token_symbol: symbol.toUpperCase(),
      token_name: name,
      coingecko_id: coinId ?? null,
      commit_sha: null,
      commit_message: `Community-flagged by ${walletAddress.slice(0, 10)}…`,
      groq_reasoning: "Manually flagged by a community member as a potential rug pull.",
      groq_confidence: 50,
      price_at_creation: priceScaled,
      created_at: now,
      resolves_at: resolvesAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      resolved: false,
    };

    let { error } = await supabase.from("markets").insert(row);
    if (error) {
      await new Promise((r) => setTimeout(r, 1_000));
      ({ error } = await supabase.from("markets").insert(row));
    }
    if (error) throw new Error(`DB insert failed: ${toMessage(error)}`);

    return NextResponse.json({ marketId });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 500 });
  }
}
