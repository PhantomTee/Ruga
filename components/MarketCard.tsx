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
    <article className="border-2 border-black bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 border-b-2 border-black">
        <Link href={`/market/${market.id}`} className="min-w-0">
          <div className="font-display text-5xl leading-none text-black truncate">
            {marketSymbol(market)}
          </div>
          <div className="font-mono text-xs text-black/40 uppercase mt-1">rug or hodl?</div>
        </Link>
        <div className="font-mono text-xs text-right shrink-0 pt-1">
          {market.resolved ? (
            <span className={`font-bold uppercase ${market.outcome ? "text-ruga-red" : "text-black"}`}>
              {market.outcome ? "RUGGED" : "SURVIVED"}
            </span>
          ) : (
            <span className="text-black/50">{formatDuration(remaining)}</span>
          )}
        </div>
      </div>

      {/* Pool bar */}
      <div className="px-4 py-3 border-b-2 border-black">
        <div className="h-2 bg-black/10 w-full">
          <div className="h-full bg-black transition-all" style={{ width: `${yesPct}%` }} />
        </div>
        <div className="flex justify-between mt-2 font-mono text-xs text-black/60">
          <span>YES {yesPct}% · {yes.toFixed(0)} USDC</span>
          <span>NO {noPct}% · {no.toFixed(0)} USDC</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-0 mt-auto">
        <button
          disabled={market.resolved}
          onClick={() => setBetSide("yes")}
          className="border-r border-black py-3 font-display text-2xl bg-black text-white hover:bg-ruga-red hover:text-black transition-colors disabled:opacity-25"
        >
          YES
        </button>
        <button
          disabled={market.resolved}
          onClick={() => setBetSide("no")}
          className="py-3 font-display text-2xl bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-25"
        >
          NO
        </button>
      </div>

      {betSide && (
        <BetModal
          market={market}
          side={betSide}
          onClose={() => setBetSide(null)}
          onSuccess={() => { setBetSide(null); onRefresh(); }}
        />
      )}
    </article>
  );
}
