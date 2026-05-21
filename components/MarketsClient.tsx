"use client";

import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { MarketCard } from "./MarketCard";
import type { Market } from "./types";

function LoadingDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(count)}</span>;
}

function SkeletonCard() {
  return (
    <div className="border-2 border-black bg-white flex flex-col animate-pulse">
      <div className="p-4 border-b-2 border-black space-y-2">
        <div className="h-12 w-3/4 bg-black/10 rounded" />
        <div className="h-3 w-1/3 bg-black/10 rounded" />
      </div>
      <div className="px-4 py-3 border-b-2 border-black space-y-2">
        <div className="h-2 w-full bg-black/10 rounded" />
        <div className="flex justify-between">
          <div className="h-3 w-1/3 bg-black/10 rounded" />
          <div className="h-3 w-1/3 bg-black/10 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 mt-auto">
        <div className="border-r border-black py-3 bg-black/5" />
        <div className="py-3 bg-black/5" />
      </div>
    </div>
  );
}

export function MarketsClient() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/markets", { cache: "no-store" });
      const data = await res.json();
      setMarkets(data.markets || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = window.setInterval(load, 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        <h1 className="font-display leading-none text-black mb-10" style={{ fontSize: "clamp(4rem, 14vw, 12rem)" }}>
          LIVE<br />MARKETS.
        </h1>

        {loading ? (
          <>
            <p className="font-display text-3xl text-black mb-6">
              LOADING<LoadingDots />
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </>
        ) : markets.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">NO MARKETS YET.</div>
            <p className="font-mono text-sm text-black/60">
              The AI is watching. When a token gets flagged across multiple
              detection sources, a market opens here automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} onRefresh={load} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
