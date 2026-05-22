"use client";

import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { MarketCard } from "./MarketCard";
import { CreateMarketModal } from "./CreateMarketModal";
import type { Market } from "./types";

function marketYesPool(market: Market) {
  return Number(market.yesPool ?? market.yes_pool ?? 0);
}

function marketNoPool(market: Market) {
  return Number(market.noPool ?? market.no_pool ?? 0);
}

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
  const [showCreate, setShowCreate] = useState(false);
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "med" | "low">("all");
  const [sortOption, setSortOption] = useState<"newest" | "risk" | "liquidity">("newest");

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

  function getRiskLevel(confidence: number | null | undefined): "high" | "med" | "low" {
    if (confidence == null) return "low";
    if (confidence >= 70) return "high";
    if (confidence >= 50) return "med";
    return "low";
  }

  const filteredMarkets = markets.filter((market) => {
    if (riskFilter === "all") return true;
    return getRiskLevel(market.groq_confidence) === riskFilter;
  });

  const sortedMarkets = [...filteredMarkets].sort((a, b) => {
    if (sortOption === "risk") {
      return (b.groq_confidence ?? 0) - (a.groq_confidence ?? 0);
    }
    if (sortOption === "liquidity") {
      const aLiquidity = marketYesPool(a) + marketNoPool(a);
      const bLiquidity = marketYesPool(b) + marketNoPool(b);
      return bLiquidity - aLiquidity;
    }
    const aCreated = Date.parse(a.created_at || a.createdAt || "1970-01-01T00:00:00Z");
    const bCreated = Date.parse(b.created_at || b.createdAt || "1970-01-01T00:00:00Z");
    return bCreated - aCreated;
  });

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        {/* Title row */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <h1 className="font-display leading-none text-black" style={{ fontSize: "clamp(4rem, 14vw, 12rem)" }}>
            LIVE<br />MARKETS.
          </h1>
          <button
            onClick={() => setShowCreate(true)}
            className="font-display text-2xl bg-black text-white px-6 py-3 border-2 border-black hover:bg-ruga-dim transition-colors shrink-0 self-end mb-1"
          >
            + FLAG TOKEN
          </button>
        </div>

        {!loading && markets.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="flex flex-wrap gap-2">
              {(["all", "high", "med", "low"] as const).map((filter) => {
                const isActive = riskFilter === filter;
                const label = filter === "all" ? "ALL RISKS" : filter === "high" ? "HIGH RISK" : filter === "med" ? "MED RISK" : "LOW RISK";
                const base = "font-mono text-xs px-4 py-2 border-2 border-black transition-colors";
                const activeClass =
                  filter === "high"
                    ? "bg-ruga-red text-white"
                    : filter === "med"
                    ? "bg-amber-500 text-white"
                    : filter === "low"
                    ? "bg-black text-white"
                    : "bg-black text-white";
                return (
                  <button
                    key={filter}
                    onClick={() => setRiskFilter(filter)}
                    className={`${base} ${isActive ? activeClass : "bg-white text-black hover:bg-black/5"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="font-mono text-xs text-black/40 uppercase">Sort</label>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as "newest" | "risk" | "liquidity")}
                className="font-mono text-xs border-2 border-black bg-white px-3 py-2"
              >
                <option value="newest">Newest</option>
                <option value="risk">Highest Risk</option>
                <option value="liquidity">Most Liquidity</option>
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <>
            <p className="font-display text-3xl text-black mb-6">LOADING<LoadingDots /></p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </>
        ) : markets.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">NO MARKETS YET.</div>
            <p className="font-mono text-sm text-black/60">
              The AI is watching. When a token gets flagged across multiple
              detection sources, a market opens here automatically. Or flag one yourself.
            </p>
          </div>
        ) : sortedMarkets.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">NO {riskFilter.toUpperCase()} RISK MARKETS.</div>
            <p className="font-mono text-sm text-black/60">
              Try a different risk filter to see other markets.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedMarkets.map((market) => (
              <MarketCard key={market.id} market={market} onRefresh={load} />
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateMarketModal onCreated={load} onClose={() => { setShowCreate(false); load(); }} />}
    </main>
  );
}
