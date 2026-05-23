"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { formatDuration, secondsRemaining } from "@/lib/format";
import { BetModal } from "./BetModal";
import type { Market } from "./types";
import { marketSymbol, noPool, resolvesAt, yesPool } from "./types";

export function MarketCard({ market, onRefresh }: { market: Market; onRefresh: () => void }) {
  const { address } = useAccount();
  const [betSide, setBetSide] = useState<"yes" | "no" | null>(null);
  const [remaining, setRemaining] = useState(secondsRemaining(resolvesAt(market)));
  const yes = yesPool(market);
  const no = noPool(market);
  const total = yes + no;
  const yesPct = total ? Math.round((yes / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const yesWidth = Math.min(100, Math.max(0, yesPct));

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
          <div className="flex items-center gap-2 mt-1">
            <div className="font-mono text-xs text-black/40 uppercase">rug or hodl?</div>
            <RiskBadge confidence={market.groq_confidence} />
          </div>
        </Link>
        <div className="font-mono text-xs text-right shrink-0 pt-1">
          {market.resolved ? (
            <span className={`font-bold uppercase ${market.outcome ? "text-ruga-red" : "text-black"}`}>
              {market.outcome ? "RUGGED" : "SURVIVED"}
            </span>
          ) : (
            <span className={`tabular-nums ${remaining < 86400 ? "text-ruga-red font-bold" : "text-black/50"}`}>
              {formatDuration(remaining)}
            </span>
          )}
        </div>
      </div>

      {/* Pool bar */}
      <div className="px-4 py-3 border-b-2 border-black">
        <div
          className="relative h-4 w-full overflow-hidden border border-black/60 bg-white shadow-[inset_2px_2px_0_rgba(0,0,0,0.18),inset_-1px_-1px_0_rgba(255,255,255,0.7)]"
          aria-label={`YES pool ${yesPct} percent, NO pool ${noPct} percent`}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.08)_25%,transparent_25%,transparent_50%,rgba(0,0,0,0.08)_50%,rgba(0,0,0,0.08)_75%,transparent_75%,transparent)] bg-[length:10px_10px]" />
          <div
            className="relative h-full border-r border-black/50 bg-[linear-gradient(180deg,#3a3a3a_0%,#050505_45%,#000_46%,#1a1a1a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_0_rgba(0,0,0,0.45),2px_0_0_rgba(255,49,49,0.35)] transition-[width] duration-300 ease-out"
            style={{ width: `${yesWidth}%`, borderRightWidth: yesWidth === 0 || yesWidth === 100 ? 0 : 1 }}
          />
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
          className="border-r border-black py-3 font-display text-2xl bg-black text-white hover:bg-ruga-red hover:text-black transition-colors disabled:opacity-25 relative group"
        >
          YES
          {!address && !market.resolved && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/80 text-white font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity">
              connect wallet
            </span>
          )}
        </button>
        <button
          disabled={market.resolved}
          onClick={() => setBetSide("no")}
          className="py-3 font-display text-2xl bg-white text-black hover:bg-black hover:text-white transition-colors disabled:opacity-25 relative group"
        >
          NO
          {!address && !market.resolved && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/80 text-white font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity">
              connect wallet
            </span>
          )}
        </button>
      </div>

      {/* Share */}
      <div className="px-4 pb-3 pt-1 flex justify-end">
        <button
          onClick={() => {
            const text = `Will $${marketSymbol(market)} rug within 7 days? I'm betting on Ruga — the AI-powered prediction market for crypto rugs.`;
            const url = `https://ruga-app.vercel.app/market/${market.id}`;
            window.open(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
              "_blank"
            );
          }}
          className="font-mono text-xs text-black/40 hover:text-black transition-colors underline underline-offset-2"
        >
          share ↗
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

function RiskBadge({ confidence }: { confidence?: number | null }) {
  if (confidence == null) return null;
  const level = confidence >= 70 ? "HIGH" : confidence >= 50 ? "MED" : "LOW";
  const cls = confidence >= 70
    ? "border-ruga-red text-ruga-red"
    : confidence >= 50
    ? "border-amber-500 text-amber-600"
    : "border-black/30 text-black/40";
  return (
    <span className={`font-mono text-[10px] border px-1.5 py-0.5 uppercase tracking-wide ${cls}`}>
      {level} RISK
    </span>
  );
}
