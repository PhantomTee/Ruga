"use client";

import Link from "next/link";
import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { RUGA_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { formatUsd, truncateAddress } from "@/lib/format";
import { unscaleUsd } from "@/lib/price";
import { BetModal } from "./BetModal";
import { Nav } from "./Nav";
import { PriceChart } from "./PriceChart";
import type { Bet, Market } from "./types";
import { coingeckoId, marketName, marketSymbol, noPool, yesPool } from "./types";

export function MarketDetailClient({ id }: { id: string }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [prices, setPrices] = useState<Array<[number, number]>>([]);
  const [side, setSide] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const load = useCallback(async () => {
    const response = await fetch(`/api/markets/${id}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load market");
    setMarket(payload.market);
    setBets(payload.bets || []);
    setPrices(payload.chart?.prices || []);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load market"));
  }, [load]);

  if (error) {
    return (
      <div className="min-h-screen bg-ruga-red">
        <Nav />
        <div className="px-6 py-10 font-mono text-sm text-black">{error}</div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-ruga-red">
        <Nav />
        <div className="px-6 py-10 font-display text-6xl text-black animate-pulse">LOADING…</div>
      </div>
    );
  }

  const start = Number(market.priceAtCreation ?? unscaleUsd(market.price_at_creation));
  const final = unscaleUsd(market.final_price);
  const change = final && start ? ((final - start) / start) * 100 : null;

  async function claimWinnings() {
    try {
      setClaimError(null);
      setClaimTx(null);
      if (!address) throw new Error("Connect a wallet before claiming");
      if (!walletClient) throw new Error("No active wallet client found");
      if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not configured");
      if (!market) throw new Error("Market not loaded");
      setClaiming(true);
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const signer = await provider.getSigner();
      const ruga = new Contract(CONTRACT_ADDRESS, RUGA_MARKET_ABI, signer);
      const tx = await ruga.claimWinnings(market.on_chain_id || market.id);
      const receipt = await tx.wait();
      setClaimTx(receipt.hash);
    } catch (err) {
      const rejected = JSON.stringify(err).includes("4001");
      setClaimError(rejected ? "Claim rejected in wallet" : err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="min-h-screen bg-ruga-red">
      <Nav />

      <div className="px-6 py-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Title block */}
          <div className="border-2 border-black bg-white p-6">
            <div className="font-mono text-xs text-black/40 uppercase">Market #{market.id}</div>
            <h1 className="font-display leading-none text-black mt-1" style={{ fontSize: "clamp(4rem, 10vw, 8rem)" }}>
              {marketSymbol(market)}
            </h1>
            <div className="font-mono text-sm text-black/50 mt-1">{marketName(market)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
              <Stat label="YES Pool" value={`${formatUsd(yesPool(market))} USDC`} />
              <Stat label="NO Pool" value={`${formatUsd(noPool(market))} USDC`} />
              <Stat label="Open Price" value={`$${Number(start).toExponential(3)}`} />
              <Stat
                label="Status"
                value={market.resolved ? (market.outcome ? "RUGGED" : "SURVIVED") : "OPEN"}
                highlight={market.resolved && Boolean(market.outcome)}
              />
            </div>
          </div>

          {/* Chart */}
          <div className="border-2 border-black bg-white p-4">
            <PriceChart prices={prices} />
          </div>

          {/* Groq reasoning */}
          <div className="border-2 border-black bg-white p-5">
            <div className="font-display text-xl text-black mb-3">WHY RUGA FLAGGED THIS</div>
            <p className="font-mono text-sm text-black/70 whitespace-pre-wrap leading-6">
              {market.groq_reasoning || "No reasoning stored for this market."}
            </p>
          </div>

          {/* Resolution */}
          {market.resolved && (
            <div className="border-2 border-black bg-white p-5 font-mono text-sm text-black">
              Final price: ${final?.toExponential(4)} · Change: {change?.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Bet / Claim */}
          <div className="border-2 border-black bg-white p-5">
            {!market.resolved ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSide("yes")}
                  className="border-2 border-black bg-black text-white py-4 font-display text-2xl hover:bg-ruga-red hover:text-black transition-colors"
                >
                  YES
                </button>
                <button
                  onClick={() => setSide("no")}
                  className="border-2 border-black bg-white text-black py-4 font-display text-2xl hover:bg-black hover:text-white transition-colors"
                >
                  NO
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={claimWinnings}
                  disabled={claiming}
                  className="w-full border-2 border-black bg-black text-white py-4 font-display text-2xl hover:bg-ruga-red hover:text-black transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {claiming ? "CLAIMING…" : "CLAIM WINNINGS"}
                </button>
                {claimTx && <div className="mt-3 font-mono text-xs text-black/50 break-all">TX: {claimTx}</div>}
                {claimError && <div className="mt-3 border-2 border-black bg-ruga-red/10 p-3 font-mono text-xs text-black">{claimError}</div>}
              </div>
            )}

            <div className="mt-4 space-y-1 font-mono text-xs text-black/40">
              {coingeckoId(market) && (
                <a
                  href={`https://www.coingecko.com/en/coins/${coingeckoId(market)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block underline hover:text-black"
                >
                  CoinGecko ↗
                </a>
              )}
              {market.commit_sha && (
                <a
                  href={`https://github.com/iterativv/NostalgiaForInfinity/commit/${market.commit_sha}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block underline hover:text-black"
                >
                  GitHub commit ↗
                </a>
              )}
            </div>
          </div>

          {/* Bet history */}
          <div className="border-2 border-black bg-white">
            <div className="border-b-2 border-black px-5 py-3 font-display text-xl text-black">BET HISTORY</div>
            <div className="max-h-96 overflow-y-auto divide-y-2 divide-black">
              {bets.map((bet) => (
                <div key={bet.id} className="flex items-center justify-between px-5 py-3 gap-3">
                  <span className="font-mono text-xs text-black/50 truncate">{truncateAddress(bet.wallet_address)}</span>
                  <span className={`font-display text-lg ${bet.side === "yes" ? "text-black" : "text-ruga-red"}`}>
                    {bet.side.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs text-black shrink-0">{formatUsd(bet.amount)} USDC</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {side && (
        <BetModal market={market} side={side} onClose={() => setSide(null)} onSuccess={() => { setSide(null); load(); }} />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border-2 border-black p-3">
      <div className="font-mono text-xs text-black/40 uppercase">{label}</div>
      <div className={`font-mono text-sm font-bold mt-1 ${highlight ? "text-ruga-red" : "text-black"}`}>{value}</div>
    </div>
  );
}
