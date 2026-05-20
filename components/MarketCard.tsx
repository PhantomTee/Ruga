"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDuration, secondsRemaining } from "@/lib/format";
import { BetModal } from "./BetModal";
import type { Market } from "./types";
import { marketSymbol, noPool, resolvesAt, yesPool } from "./types";

export function MarketCard({ market, onRefresh }: { market: Market; onRefresh: () => void }) {
  const [betSide, setBetSide] = useState<"yes" | "no" | null>(null);
  const [remaining, setRemaining] = useState(secondsRemaining(resolvesAt(market)));
  const yes = yesPool(market);
  const no = noPool(market);
  const total = yes + no;
  const yesPct = total ? Math.round((yes / total) * 100) : 50;
  const noPct = 100 - yesPct;

  useEffect(() => {
    const interval = window.setInterval(() => setRemaining(secondsRemaining(resolvesAt(market))), 1000);
    return () => window.clearInterval(interval);
  }, [market]);

  return (
    <article className="border border-ruga-line bg-ruga-panel p-4 transition hover:border-ruga-green/70">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/market/${market.id}`} className="min-w-0">
          <div className="truncate text-3xl font-black text-white">{marketSymbol(market)}</div>
          <div className="text-xs uppercase text-ruga-green">RUG OR HODL?</div>
        </Link>
        <div className="text-right text-xs">
          {market.resolved ? (
            <span className={market.outcome ? "text-ruga-green" : "text-ruga-red"}>
              {market.outcome ? "RUGGED ✓" : "SURVIVED ✗"}
            </span>
          ) : (
            <span className="text-white/65">{formatDuration(remaining)}</span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-3 overflow-hidden border border-ruga-line bg-black">
          <div className="h-full bg-ruga-green" style={{ width: `${yesPct}%` }} />
        </div>
        <div className="grid grid-cols-2 text-xs">
          <div className="text-ruga-green">YES {yesPct}% / {yes.toFixed(2)} USDC</div>
          <div className="text-right text-ruga-red">NO {noPct}% / {no.toFixed(2)} USDC</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          disabled={market.resolved}
          onClick={() => setBetSide("yes")}
          className="bg-ruga-green px-3 py-2 text-sm font-black uppercase text-black disabled:opacity-30"
        >
          Bet Yes
        </button>
        <button
          disabled={market.resolved}
          onClick={() => setBetSide("no")}
          className="bg-ruga-red px-3 py-2 text-sm font-black uppercase text-black disabled:opacity-30"
        >
          Bet No
        </button>
      </div>

      {betSide ? (
        <BetModal
          market={market}
          side={betSide}
          onClose={() => setBetSide(null)}
          onSuccess={() => {
            setBetSide(null);
            onRefresh();
          }}
        />
      ) : null}
    </article>
  );
}
