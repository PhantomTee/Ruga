"use client";

import Link from "next/link";
import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { useModal } from "connectkit";
import { assertArcWalletNetwork, assertContractDeployed, getArcChainId } from "@/lib/arc-wallet";
import { RUGA_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { formatUsd, truncateAddress } from "@/lib/format";
import { unscaleUsd } from "@/lib/price";
import { BetModal } from "./BetModal";
import { Nav } from "./Nav";
import { PriceChart } from "./PriceChart";
import { useToast } from "./Toast";
import type { Bet, Market } from "./types";
import { marketName, marketSymbol, noPool, yesPool } from "./types";

export function MarketDetailClient({ id }: { id: string }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [prices, setPrices] = useState<Array<[number, number]>>([]);
  const [side, setSide] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [showResolution, setShowResolution] = useState(false);
  const animShown = useRef(false);
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { setOpen: openConnectKit } = useModal();
  const { show: showToast } = useToast();

  const load = useCallback(async () => {
    const response = await fetch(`/api/markets/${id}?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" }
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load market");
    setMarket(payload.market);
    setBets(payload.bets || []);
    setPrices(payload.chart?.prices || []);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load market"));
  }, [load]);

  useEffect(() => {
    const onRefresh = () => load().catch(() => {});
    const t = window.setInterval(onRefresh, 5_000);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("ruga:bet-recorded", onRefresh);
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("ruga-live") : null;
    if (channel) {
      channel.onmessage = (event) => {
        if (["bet-recorded", "market-resolved"].includes(event.data?.type)) onRefresh();
      };
    }
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("ruga:bet-recorded", onRefresh);
      channel?.close();
    };
  }, [load]);

  // Show resolution animation once per market per session
  useEffect(() => {
    if (!market?.resolved || animShown.current) return;
    const key = `ruga_resolved_${id}`;
    if (sessionStorage.getItem(key)) return;
    animShown.current = true;
    sessionStorage.setItem(key, "1");
    setShowResolution(true);
    const t = setTimeout(() => setShowResolution(false), 3500);
    return () => clearTimeout(t);
  }, [market, id]);

  if (error) {
    const notFound = error.toLowerCase().includes("not found") || error.toLowerCase().includes("no rows");
    return (
      <div className="min-h-screen bg-ruga-red">
        <Nav />
        <div className="px-6 py-10">
          <h1 className="font-display text-black leading-none mb-6" style={{ fontSize: "clamp(3rem,12vw,8rem)" }}>
            {notFound ? "MARKET NOT FOUND." : "ERROR."}
          </h1>
          <p className="font-mono text-sm text-black/60 mb-8 max-w-sm">
            {notFound
              ? "This market doesn't exist or was removed. The contract may have been redeployed."
              : error}
          </p>
          <Link href="/markets" className="font-display text-2xl bg-black text-white px-8 py-3 border-2 border-black hover:bg-ruga-dim transition-colors">
            ← ALL MARKETS
          </Link>
        </div>
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

  // My bets on this market
  const myBets = address
    ? bets.filter((b) => b.wallet_address.toLowerCase() === address.toLowerCase())
    : [];

  // Estimated winnings calc (for resolved markets)
  function calcEstimatedPayout(userSide: "yes" | "no", stake: number): number {
    if (!market) return 0;
    const winPool = userSide === "yes" ? yesPool(market) : noPool(market);
    const losePool = userSide === "yes" ? noPool(market) : yesPool(market);
    if (winPool <= 0) return stake;
    const gross = stake + (losePool * stake) / winPool;
    return gross * 0.98; // 2% fee
  }

  const myWinningBets = myBets.filter(
    (b) => market.resolved && ((market.outcome && b.side === "yes") || (!market.outcome && b.side === "no"))
  );
  const myTotalStake = myWinningBets.reduce((s, b) => s + Number(b.amount), 0);
  const myEstimatedPayout =
    myWinningBets.length > 0
      ? calcEstimatedPayout(myWinningBets[0].side as "yes" | "no", myTotalStake)
      : 0;

  function shareMarket() {
    const sym = marketSymbol(market!);
    const side = !market!.resolved
      ? `Will $${sym} rug in 7 days? Bet YES or NO on Ruga.`
      : market!.outcome
      ? `$${sym} RUGGED. Did you call it on Ruga?`
      : `$${sym} SURVIVED. Did you call it on Ruga?`;
    const url = `https://ruga-app.vercel.app/market/${id}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(side)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
  }

  async function claimWinnings() {
    try {
      setClaimError(null);
      setClaimTx(null);
      if (!address) { openConnectKit(true); return; }
      if (!walletClient) throw new Error("No active wallet client found");
      if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not configured");
      if (!market) throw new Error("Market not loaded");
      setClaiming(true);
      if (chainId !== getArcChainId()) {
        await switchChainAsync({ chainId: getArcChainId() });
      }
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      await assertArcWalletNetwork(provider);
      await assertContractDeployed(provider, CONTRACT_ADDRESS, "RugaMarket");
      const signer = await provider.getSigner();
      const ruga = new Contract(CONTRACT_ADDRESS, RUGA_MARKET_ABI, signer);
      const tx = await ruga.claimWinnings(market.on_chain_id || market.id);
      const receipt = await tx.wait();
      setClaimTx(receipt.hash);
      showToast(`Winnings claimed! ~${myEstimatedPayout.toFixed(2)} USDC ✓`);
    } catch (err) {
      const rejected = JSON.stringify(err).includes("4001");
      setClaimError(rejected ? "Claim rejected in wallet" : err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="min-h-screen bg-ruga-red">
      {/* Resolution animation overlay */}
      {showResolution && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={{ background: market?.outcome ? "#FF1515" : "#000" }}
          onClick={() => setShowResolution(false)}
        >
          <div
            className="font-display leading-none text-center animate-bounce"
            style={{ fontSize: "clamp(6rem, 25vw, 18rem)", color: market?.outcome ? "#000" : "#FF1515" }}
          >
            {market?.outcome ? "RUGGED" : "SURVIVED"}
          </div>
          <div className="font-mono text-sm mt-6 opacity-60" style={{ color: market?.outcome ? "#000" : "#fff" }}>
            {market?.outcome ? "💀 this token is dead" : "✓ still breathing"}
          </div>
          <div className="font-mono text-xs mt-4 opacity-40" style={{ color: market?.outcome ? "#000" : "#fff" }}>
            tap to continue
          </div>
        </div>
      )}

      <Nav />

      <div className="px-6 py-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Title block */}
          <div className="border-2 border-black bg-white p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="font-mono text-xs text-black/40 uppercase">Market #{market.display_id ?? market.id}</div>
              <button
                onClick={shareMarket}
                className="font-mono text-xs text-black/40 hover:text-black transition-colors underline underline-offset-2 shrink-0"
              >
                share ↗
              </button>
            </div>
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

          {/* Rug Score */}
          {market.groq_confidence != null && (
            <div className="border-2 border-black bg-white p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-xl text-black">RUG SCORE</div>
                <div className={`font-mono text-xs px-2 py-1 border ${
                  market.groq_confidence >= 70
                    ? "border-ruga-red text-ruga-red"
                    : market.groq_confidence >= 50
                    ? "border-amber-500 text-amber-600"
                    : "border-black/30 text-black/40"
                }`}>
                  {market.groq_confidence >= 70 ? "HIGH RISK" : market.groq_confidence >= 50 ? "MED RISK" : "LOW RISK"}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-4 bg-black/10 border border-black/20">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${market.groq_confidence}%`,
                      background: market.groq_confidence >= 70 ? "#FF1515" : market.groq_confidence >= 50 ? "#f59e0b" : "#000"
                    }}
                  />
                </div>
                <div className="font-display text-3xl text-black w-16 text-right">{market.groq_confidence}</div>
              </div>
              <div className="font-mono text-xs text-black/40 mt-1">AI confidence score / 100</div>
            </div>
          )}

          {/* Groq reasoning */}
          <div className="border-2 border-black bg-white p-5">
            <div className="font-display text-xl text-black mb-3">WHY RUGA FLAGGED THIS</div>
            <p className="font-mono text-sm text-black/70 whitespace-pre-wrap leading-6">
              {market.groq_reasoning || "No reasoning stored for this market."}
            </p>
          </div>

          {/* DexScreener live feed */}
          <DexScreenerWidget symbol={marketSymbol(market)} />

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
                  onClick={() => {
                    if (!address) { openConnectKit(true); return; }
                    setSide("yes");
                  }}
                  className="border-2 border-black bg-black text-white py-4 font-display text-2xl hover:bg-ruga-red hover:text-black transition-colors"
                >
                  YES
                </button>
                <button
                  onClick={() => {
                    if (!address) { openConnectKit(true); return; }
                    setSide("no");
                  }}
                  className="border-2 border-black bg-white text-black py-4 font-display text-2xl hover:bg-black hover:text-white transition-colors"
                >
                  NO
                </button>
              </div>
            ) : (
              <div>
                {/* Estimated payout */}
                {myEstimatedPayout > 0 && (
                  <div className="border-2 border-black bg-ruga-red/10 p-4 mb-3">
                    <div className="font-mono text-xs text-black/50 uppercase mb-1">Your estimated payout</div>
                    <div className="font-display text-3xl text-black">
                      ~{myEstimatedPayout.toFixed(2)} USDC
                    </div>
                    <div className="font-mono text-xs text-black/40 mt-1">after 2% protocol fee</div>
                  </div>
                )}
                <button
                  onClick={claimWinnings}
                  disabled={claiming}
                  className="w-full border-2 border-black bg-black text-white py-4 font-display text-2xl hover:bg-ruga-red hover:text-black transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  {claiming ? "CLAIMING…" : "CLAIM WINNINGS"}
                </button>
                {claimTx && <div className="mt-3 font-mono text-xs text-black/50 break-all">TX: {claimTx}</div>}
                {claimError && (
                  <div className="mt-3 border-2 border-black bg-ruga-red/10 p-3 font-mono text-xs text-black">
                    {claimError}
                  </div>
                )}
              </div>
            )}

            {/* My bets on this market */}
            {myBets.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-black">
                <div className="font-mono text-xs text-black/40 uppercase mb-2">My bets</div>
                {myBets.map((b) => (
                  <div key={b.id} className="flex justify-between font-mono text-xs text-black">
                    <span className={b.side === "yes" ? "font-bold" : "text-ruga-red font-bold"}>
                      {b.side.toUpperCase()}
                    </span>
                    <span>{formatUsd(b.amount)} USDC</span>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Bet history */}
          <div className="border-2 border-black bg-white">
            <div className="border-b-2 border-black px-5 py-3 font-display text-xl text-black">BET HISTORY</div>
            <div className="max-h-96 overflow-y-auto divide-y-2 divide-black">
              {bets.length === 0 ? (
                <div className="px-5 py-4 font-mono text-xs text-black/40">No bets yet. Be first.</div>
              ) : (
                bets.map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <span className="font-mono text-xs text-black/50 truncate">
                      {address && bet.wallet_address.toLowerCase() === address.toLowerCase()
                        ? <span className="text-black font-bold">you</span>
                        : truncateAddress(bet.wallet_address)}
                    </span>
                    <span className={`font-display text-lg ${bet.side === "yes" ? "text-black" : "text-ruga-red"}`}>
                      {bet.side.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs text-black shrink-0">{formatUsd(bet.amount)} USDC</span>
                  </div>
                ))
              )}
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

function DexScreenerWidget({ symbol }: { symbol: string }) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [dexUrl, setDexUrl] = useState(`https://dexscreener.com/search?q=${encodeURIComponent(symbol)}`);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((data) => {
        const pair = data.pairs?.[0];
        if (pair?.url) {
          setEmbedUrl(`${pair.url}?embed=1&theme=dark`);
          setDexUrl(pair.url);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [symbol]);

  return (
    <div className="border-2 border-black bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display text-xl text-black">LIVE CHART</div>
        <a
          href={dexUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-black/40 hover:text-black transition-colors underline underline-offset-2"
        >
          DEXSCREENER ↗
        </a>
      </div>

      {!ready ? (
        <div className="h-80 flex items-center justify-center font-mono text-xs text-black/30 animate-pulse">
          LOADING CHART…
        </div>
      ) : embedUrl ? (
        <iframe
          src={embedUrl}
          title={`${symbol} on DexScreener`}
          className="w-full border-0 h-64 sm:h-[420px]"
          loading="lazy"
          allow="clipboard-write"
        />
      ) : (
        <div className="h-32 flex flex-col items-center justify-center gap-3">
          <p className="font-mono text-sm text-black/40">No chart found for ${symbol}</p>
          <a
            href={dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
          >
            SEARCH DEXSCREENER ↗
          </a>
        </div>
      )}
    </div>
  );
}
