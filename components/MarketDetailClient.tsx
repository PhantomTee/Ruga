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

  if (error) return <Shell><div className="border border-ruga-red bg-ruga-red/10 p-4 text-ruga-red">{error}</div></Shell>;
  if (!market) return <Shell><div className="p-4 text-white/50">Loading market...</div></Shell>;

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
      if (!market) throw new Error("Market is not loaded");

      setClaiming(true);
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const signer = await provider.getSigner();
      const ruga = new Contract(CONTRACT_ADDRESS, RUGA_MARKET_ABI, signer);
      const tx = await ruga.claimWinnings(market.on_chain_id || market.id);
      const receipt = await tx.wait();
      setClaimTx(receipt.hash);
    } catch (err) {
      const rejected =
        typeof err === "object" &&
        err !== null &&
        ("code" in err || "info" in err) &&
        JSON.stringify(err).includes("4001");
      setClaimError(rejected ? "Claim rejected in wallet" : err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Shell>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4">
          <div className="border border-ruga-line bg-ruga-panel p-4">
            <div className="text-xs uppercase text-ruga-green">Market #{market.id}</div>
            <h1 className="mt-2 text-5xl font-black">{marketSymbol(market)}</h1>
            <div className="mt-1 text-white/60">{marketName(market)}</div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              <Metric label="YES Pool" value={`${formatUsd(yesPool(market))} USDC`} />
              <Metric label="NO Pool" value={`${formatUsd(noPool(market))} USDC`} />
              <Metric label="Open Price" value={`$${Number(start).toExponential(4)}`} />
              <Metric label="Status" value={market.resolved ? (market.outcome ? "RUGGED" : "SURVIVED") : "OPEN"} danger={market.resolved && !market.outcome} />
            </div>
          </div>

          <PriceChart prices={prices} />

          <div className="border border-ruga-line bg-black p-4">
            <h2 className="text-sm font-black text-ruga-green">WHY RUGA FLAGGED THIS</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/75">{market.groq_reasoning || "No Groq reasoning stored for this market."}</p>
          </div>

          {market.resolved ? (
            <div className="border border-ruga-line bg-ruga-panel p-4 text-sm">
              Final price: ${final.toExponential(4)} / Change: {change?.toFixed(2)}%
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="border border-ruga-line bg-ruga-panel p-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setSide("yes")} disabled={market.resolved} className="bg-ruga-green px-3 py-3 font-black uppercase text-black disabled:opacity-30">Bet Yes</button>
              <button onClick={() => setSide("no")} disabled={market.resolved} className="bg-ruga-red px-3 py-3 font-black uppercase text-black disabled:opacity-30">Bet No</button>
            </div>
            {market.resolved ? (
              <div className="mt-3">
                <button
                  onClick={claimWinnings}
                  disabled={claiming}
                  className="w-full border border-ruga-green px-3 py-3 text-sm font-black uppercase text-ruga-green hover:bg-ruga-green hover:text-black disabled:cursor-wait disabled:opacity-50"
                >
                  {claiming ? "Claiming Winnings" : "Claim Winnings"}
                </button>
                {claimTx ? <div className="mt-2 break-all text-xs text-ruga-green">Claim tx: {claimTx}</div> : null}
                {claimError ? <div className="mt-2 border border-ruga-red bg-ruga-red/10 p-2 text-xs text-ruga-red">{claimError}</div> : null}
              </div>
            ) : null}
            <div className="mt-4 space-y-2 text-xs text-white/60">
              {coingeckoId(market) ? <a className="block text-ruga-green" href={`https://www.coingecko.com/en/coins/${coingeckoId(market)}`} target="_blank" rel="noreferrer">CoinGecko: {coingeckoId(market)}</a> : null}
              {market.commit_sha ? <a className="block text-ruga-green" href={`https://github.com/iterativv/NostalgiaForInfinity/commit/${market.commit_sha}`} target="_blank" rel="noreferrer">GitHub commit: {market.commit_sha.slice(0, 12)}</a> : null}
            </div>
          </div>

          <div className="border border-ruga-line bg-ruga-panel">
            <div className="border-b border-ruga-line p-3 text-sm font-black text-ruga-green">BET HISTORY</div>
            <div className="max-h-[520px] overflow-y-auto">
              {bets.map((bet) => (
                <div key={bet.id} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-ruga-line p-3 text-xs">
                  <span>{truncateAddress(bet.wallet_address)}</span>
                  <span className={bet.side === "yes" ? "text-ruga-green" : "text-ruga-red"}>{bet.side.toUpperCase()}</span>
                  <span>{formatUsd(bet.amount)} USDC</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      {side ? <BetModal market={market} side={side} onClose={() => setSide(null)} onSuccess={() => { setSide(null); load(); }} /> : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="terminal-grid min-h-screen bg-ruga-black p-4 text-white">
      <Link className="mb-4 inline-block text-sm text-ruga-green" href="/">{"<-"} RUGA</Link>
      {children}
    </main>
  );
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="border border-ruga-line bg-black p-3">
      <div className="text-[10px] uppercase text-white/45">{label}</div>
      <div className={danger ? "text-ruga-red" : "text-white"}>{value}</div>
    </div>
  );
}
