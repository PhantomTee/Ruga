"use client";

import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { MarketCard } from "./MarketCard";
import type { Market } from "./types";

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
        {!loading && (
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
