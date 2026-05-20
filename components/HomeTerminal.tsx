"use client";

import { useEffect, useState } from "react";
import { formatUsd, truncateAddress } from "@/lib/format";
import { MarketCard } from "./MarketCard";
import { TopBar } from "./TopBar";
import type { FeedItem, Market } from "./types";

type Leader = { wallet: string; won: number };

export function HomeTerminal() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMarkets() {
    const response = await fetch("/api/markets", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load markets");
    setMarkets(payload.markets || []);
  }

  async function loadFeed() {
    const response = await fetch("/api/feed", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load feed");
    setFeed(payload.feed || []);
  }

  async function loadLeaderboard() {
    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load leaderboard");
    setLeaderboard(payload.leaderboard || []);
  }

  useEffect(() => {
    const loadAll = () =>
      Promise.all([loadMarkets(), loadFeed(), loadLeaderboard()])
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Ruga data"))
        .finally(() => setLoading(false));
    loadAll();
    const feedTimer = window.setInterval(() => loadFeed().catch(() => undefined), 30_000);
    const leaderboardTimer = window.setInterval(() => loadLeaderboard().catch(() => undefined), 60_000);
    const marketTimer = window.setInterval(() => loadMarkets().catch(() => undefined), 30_000);
    return () => {
      window.clearInterval(feedTimer);
      window.clearInterval(leaderboardTimer);
      window.clearInterval(marketTimer);
    };
  }, []);

  return (
    <main className="terminal-grid min-h-screen bg-ruga-black text-white">
      <TopBar markets={markets} />
      {error ? <div className="border-b border-ruga-red bg-ruga-red/10 px-4 py-2 text-sm text-ruga-red">{error}</div> : null}
      <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 overflow-hidden lg:grid-cols-[30%_50%_20%]">
        <section className="overflow-y-auto border-r border-ruga-line">
          <Header title="[ SIGNAL FEED - iterativv/NostalgiaForInfinity ]" />
          <div className="divide-y divide-ruga-line">
            {loading ? <LoadingLine label="Loading GitHub signal feed..." /> : null}
            {!loading && feed.map((item, index) => (
              <div key={item.sha} className={`p-3 text-xs ${index === 0 ? "animate-flash" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/45">{new Date(item.processed_at).toLocaleTimeString()}</span>
                  <span className="text-ruga-green">{item.sha.slice(0, 7)}</span>
                  <Status status={item.status} />
                </div>
                <div className="mt-2 line-clamp-2 text-white/80">{item.commit_message}</div>
                <div className="mt-2 text-white/40">{item.tokens_found?.join(", ") || "NO TOKENS"}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-y-auto border-r border-ruga-line">
          <Header title="LIVE MARKETS" />
          <div className="grid gap-3 p-3 xl:grid-cols-2">
            {loading ? <LoadingLine label="Loading live markets..." /> : null}
            {!loading && markets.map((market) => (
              <MarketCard key={market.id} market={market} onRefresh={loadMarkets} />
            ))}
          </div>
        </section>

        <section className="overflow-y-auto">
          <Header title="LEADERBOARD" />
          <div className="divide-y divide-ruga-line">
            {loading ? <LoadingLine label="Loading leaderboard..." /> : null}
            {!loading && leaderboard.map((row, index) => (
              <div key={row.wallet} className="grid grid-cols-[2rem_1fr_auto] gap-2 p-3 text-xs">
                <span className="text-ruga-green">#{index + 1}</span>
                <span>{truncateAddress(row.wallet)}</span>
                <span>${formatUsd(row.won)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Header({ title }: { title: string }) {
  return <div className="sticky top-0 z-10 border-b border-ruga-line bg-ruga-black px-3 py-2 text-xs font-black text-ruga-green">{title}</div>;
}

function LoadingLine({ label }: { label: string }) {
  return <div className="border border-ruga-line bg-black/60 p-4 text-xs text-white/55">{label}</div>;
}

function Status({ status }: { status: FeedItem["status"] }) {
  const label =
    status === "market_created"
      ? "MARKET_CREATED"
      : status === "signal_found"
        ? "SIGNAL"
        : status === "ignored"
          ? "NOISE"
          : status === "failed"
            ? "FAILED"
            : "SCANNING";
  const color =
    status === "market_created" || status === "signal_found"
      ? "text-ruga-green"
      : status === "failed"
        ? "text-ruga-red"
        : "text-white/45";
  return <span className={color}>{label}</span>;
}
