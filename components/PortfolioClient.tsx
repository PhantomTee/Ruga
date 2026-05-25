"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useModal } from "connectkit";
import { Nav } from "./Nav";
import { formatUsd, timeAgoShort } from "@/lib/format";

// Module-level cache so navigating away and back doesn't re-show a loading spinner
const portfolioCache = new Map<string, { bets: Bet[]; markets: Record<number, MarketInfo> }>();

type Bet = {
  id: string;
  market_id: number;
  wallet_address: string;
  side: "yes" | "no";
  amount: string | number;
  tx_hash: string;
  created_at: string;
};

type MarketInfo = {
  id: number;
  token_symbol: string;
  token_name: string | null;
  resolved: boolean;
  outcome: boolean | null;
  yes_pool: string | number | null;
  no_pool: string | number | null;
  resolves_at: string | null;
};

function calcPayout(bet: Bet, market: MarketInfo): number {
  const stake = Number(bet.amount);
  const yp = Number(market.yes_pool || 0);
  const np = Number(market.no_pool || 0);
  const winPool = bet.side === "yes" ? yp : np;
  const losePool = bet.side === "yes" ? np : yp;
  if (winPool <= 0) return stake;
  return (stake + (losePool * stake) / winPool) * 0.98;
}

function betResult(bet: Bet, market: MarketInfo): "win" | "loss" | "open" {
  if (!market.resolved) return "open";
  const won = (market.outcome && bet.side === "yes") || (!market.outcome && bet.side === "no");
  return won ? "win" : "loss";
}

function LoadingDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(count)}</span>;
}

export function PortfolioClient() {
  const { address } = useAccount();
  const { setOpen: openConnectKit } = useModal();
  const cached = address ? portfolioCache.get(address.toLowerCase()) : undefined;
  const [bets, setBets] = useState<Bet[]>(cached?.bets ?? []);
  const [markets, setMarkets] = useState<Record<number, MarketInfo>>(cached?.markets ?? {});
  // Only show full loading spinner on first visit; subsequent visits show stale data immediately
  const [loading, setLoading] = useState(!cached && !!address);
  const [error, setError] = useState<string | null>(null);
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!address) return;
    const key = address.toLowerCase();
    // Prevent duplicate fetches for the same address within the same mount
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;

    if (!portfolioCache.has(key)) setLoading(true);
    setError(null);

    fetch(`/api/portfolio?wallet=${key}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        const fresh = { bets: d.bets || [], markets: d.markets || {} };
        portfolioCache.set(key, fresh);
        setBets(fresh.bets);
        setMarkets(fresh.markets);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address]);

  // Compute stats
  const totalWagered = bets.reduce((s, b) => s + Number(b.amount), 0);
  const resolvedBets = bets.filter((b) => markets[b.market_id]?.resolved);
  const wins = resolvedBets.filter((b) => betResult(b, markets[b.market_id]) === "win");
  const losses = resolvedBets.filter((b) => betResult(b, markets[b.market_id]) === "loss");
  const openBets = bets.filter((b) => !markets[b.market_id]?.resolved);
  const totalPayout = wins.reduce((s, b) => s + calcPayout(b, markets[b.market_id]), 0);
  const totalStakedResolved = resolvedBets.reduce((s, b) => s + Number(b.amount), 0);
  const pnl = totalPayout - totalStakedResolved;
  const winRate = resolvedBets.length > 0 ? Math.round((wins.length / resolvedBets.length) * 100) : null;

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        <h1 className="font-display leading-none text-black mb-10" style={{ fontSize: "clamp(3rem, 12vw, 9rem)" }}>
          MY<br />PORTFOLIO.
        </h1>

        {!address ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">CONNECT WALLET.</div>
            <p className="font-mono text-sm text-black/60 mb-6">
              Connect your wallet to view your bets, P&L, and win rate.
            </p>
            <button
              onClick={() => openConnectKit(true)}
              className="font-display text-2xl bg-black text-white px-8 py-3 border-2 border-black hover:bg-ruga-dim transition-colors"
            >
              CONNECT →
            </button>
          </div>
        ) : loading ? (
          <p className="font-display text-3xl text-black">LOADING<LoadingDots /></p>
        ) : error ? (
          <p className="font-mono text-sm text-black">{error}</p>
        ) : bets.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">NO BETS YET.</div>
            <p className="font-mono text-sm text-black/60 mb-6">
              You haven&apos;t placed any bets yet. Find a market and take a position.
            </p>
            <Link
              href="/markets"
              className="font-display text-2xl bg-black text-white px-8 py-3 border-2 border-black hover:bg-ruga-dim transition-colors"
            >
              MARKETS →
            </Link>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Wagered" value={`${formatUsd(totalWagered)} USDC`} />
              <StatCard
                label="P&L (resolved)"
                value={`${pnl >= 0 ? "+" : ""}${formatUsd(pnl)} USDC`}
                highlight={pnl > 0}
                dim={pnl < 0}
              />
              <StatCard
                label="Win Rate"
                value={winRate !== null ? `${winRate}%` : "—"}
                highlight={winRate !== null && winRate >= 50}
              />
              <StatCard label="Open Positions" value={String(openBets.length)} />
            </div>

            {/* Win / Loss summary */}
            {resolvedBets.length > 0 && (
              <div className="border-2 border-black bg-white px-5 py-4 flex gap-8">
                <div>
                  <div className="font-mono text-xs text-black/40 uppercase">Wins</div>
                  <div className="font-display text-4xl text-black">{wins.length}</div>
                </div>
                <div>
                  <div className="font-mono text-xs text-black/40 uppercase">Losses</div>
                  <div className="font-display text-4xl text-ruga-red">{losses.length}</div>
                </div>
                <div>
                  <div className="font-mono text-xs text-black/40 uppercase">Total winnings</div>
                  <div className="font-display text-4xl text-black">{formatUsd(totalPayout)} USDC</div>
                </div>
              </div>
            )}

            {/* Bets table */}
            <div className="border-2 border-black bg-white">
              <div className="border-b-2 border-black px-5 py-3 font-display text-xl text-black">
                ALL BETS ({bets.length})
              </div>
              <div className="divide-y-2 divide-black">
                {bets.map((bet) => {
                  const market = markets[bet.market_id];
                  const result = market ? betResult(bet, market) : "open";
                  const payout = result === "win" && market ? calcPayout(bet, market) : null;
                  return (
                    <div key={bet.id} className="flex items-center gap-3 px-5 py-4">
                      {/* Token */}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/market/${bet.market_id}`}
                          className="font-display text-2xl text-black hover:text-ruga-red transition-colors"
                        >
                          ${market?.token_symbol || bet.market_id}
                        </Link>
                        <div className="font-mono text-xs text-black/40">{timeAgoShort(bet.created_at)}</div>
                      </div>

                      {/* Side */}
                      <div className={`font-display text-xl shrink-0 ${bet.side === "yes" ? "text-black" : "text-ruga-red"}`}>
                        {bet.side.toUpperCase()}
                      </div>

                      {/* Amount */}
                      <div className="font-mono text-sm text-black shrink-0 text-right">
                        <div>{formatUsd(bet.amount)} USDC</div>
                        {payout && (
                          <div className="text-xs text-black/40">→ ~{formatUsd(payout)}</div>
                        )}
                      </div>

                      {/* Result badge */}
                      <div className={`font-mono text-xs px-2 py-1 border shrink-0 ${
                        result === "win"
                          ? "border-black text-black bg-black/5"
                          : result === "loss"
                          ? "border-ruga-red text-ruga-red"
                          : "border-black/20 text-black/30"
                      }`}>
                        {result === "win" ? "WIN" : result === "loss" ? "LOSS" : "OPEN"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label, value, highlight, dim
}: { label: string; value: string; highlight?: boolean; dim?: boolean }) {
  return (
    <div className="border-2 border-black bg-white px-4 py-4">
      <div className="font-mono text-xs text-black/40 uppercase">{label}</div>
      <div className={`font-display text-2xl mt-1 leading-none ${
        highlight ? "text-black" : dim ? "text-ruga-red" : "text-black"
      }`}>
        {value}
      </div>
    </div>
  );
}
