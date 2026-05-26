"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { formatDuration, secondsRemaining } from "@/lib/format";

type AgentBet = { market_id: number; side: "yes" | "no"; amount: string | number; created_at: string };

type Pick = {
  id: number;
  on_chain_id: number;
  token_symbol: string;
  token_name: string | null;
  groq_confidence: number | null;
  groq_reasoning: string | null;
  yes_pool: string | number | null;
  no_pool: string | number | null;
  resolves_at: string | null;
  resolved: boolean;
  agentBet: AgentBet | null;
};

function ConfidenceMeter({ score }: { score: number }) {
  const bars = 10;
  const filled = Math.round((score / 100) * bars);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`h-3 w-2 ${i < filled ? "bg-ruga-red" : "bg-black/10"}`}
        />
      ))}
    </div>
  );
}

function PickCard({ pick }: { pick: Pick }) {
  const yes = Number(pick.yes_pool ?? 0);
  const no = Number(pick.no_pool ?? 0);
  const total = yes + no;
  const yesPct = total ? Math.round((yes / total) * 100) : 50;
  const noPct = 100 - yesPct;
  const remaining = secondsRemaining(pick.resolves_at || null);
  const confidence = pick.groq_confidence ?? 0;
  const [showReason, setShowReason] = useState(false);

  return (
    <article className="border-2 border-black bg-white flex flex-col relative">
      {/* AI badge */}
      <div className="absolute top-0 right-0 bg-black text-white font-mono text-[10px] px-2 py-1 uppercase tracking-widest">
        AI PICK
      </div>

      {/* Header */}
      <div className="p-4 border-b-2 border-black">
        <Link href={`/market/${pick.id}`} className="block">
          <div className="font-display text-5xl leading-none text-black truncate pr-14">
            ${pick.token_symbol}
          </div>
          <div className="font-mono text-xs text-black/40 uppercase mt-1">
            {pick.token_name || pick.token_symbol}
          </div>
        </Link>

        {/* Confidence bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-black/50 uppercase">AI Confidence</span>
            <span className="font-mono text-sm font-bold text-ruga-red">{confidence}%</span>
          </div>
          <ConfidenceMeter score={confidence} />
        </div>
      </div>

      {/* Pool bar */}
      <div className="px-4 py-3 border-b-2 border-black">
        <div
          className="relative h-3 w-full overflow-hidden border border-black/60 bg-white"
          aria-label={`YES ${yesPct}% NO ${noPct}%`}
        >
          <div
            className="h-full bg-[linear-gradient(180deg,#3a3a3a_0%,#000_100%)] transition-[width] duration-300 ease-out"
            style={{ width: `${yesPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 font-mono text-xs text-black/50">
          <span>YES {yesPct}% · {yes.toFixed(0)} USDC</span>
          <span>NO {noPct}% · {no.toFixed(0)} USDC</span>
        </div>
      </div>

      {/* Agent stake status */}
      <div className="px-4 py-3 border-b-2 border-black">
        {pick.agentBet ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ruga-red shrink-0 animate-pulse" />
            <span className="font-mono text-xs text-black">
              RUGA AI staked{" "}
              <span className="font-bold">{Number(pick.agentBet.amount).toFixed(0)} USDC YES</span>
              {" "}· {confidence >= 90 ? "MAX CONVICTION" : confidence >= 80 ? "HIGH CONVICTION" : "FLAGGED"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-black/20 shrink-0" />
            <span className="font-mono text-xs text-black/40">Awaiting agent stake…</span>
          </div>
        )}
      </div>

      {/* Footer: time + reasoning toggle */}
      <div className="px-4 py-3 flex items-center justify-between mt-auto">
        <span className={`font-mono text-xs ${remaining < 86400 ? "text-ruga-red font-bold" : "text-black/40"}`}>
          ⏱ {formatDuration(remaining)} left
        </span>
        <button
          onClick={() => setShowReason((v) => !v)}
          className="font-mono text-xs text-black/50 hover:text-black transition-colors border border-black/20 hover:border-black px-2 py-1"
        >
          {showReason ? "HIDE ▲" : "WHY? ▼"}
        </button>
      </div>

      {/* Reasoning panel */}
      {showReason && pick.groq_reasoning && (
        <div className="px-4 pb-4">
          <div className="border-2 border-black bg-black text-white p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">
              AI REASONING
            </div>
            <p className="font-mono text-xs text-white/80 leading-5">
              {pick.groq_reasoning}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

function LoadingDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(count)}</span>;
}

export function RugaAiClient() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [totalDeployed, setTotalDeployed] = useState(0);
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rugaai")
      .then((r) => r.json())
      .then((d) => {
        setPicks(d.picks || []);
        setTotalDeployed(d.totalDeployed || 0);
        setAgentAddress(d.agentAddress || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const picksWithBet = picks.filter((p) => p.agentBet);
  const avgConfidence = picks.length
    ? Math.round(picks.reduce((s, p) => s + (p.groq_confidence ?? 0), 0) / picks.length)
    : 0;

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1
            className="font-display leading-none text-black"
            style={{ fontSize: "clamp(4rem, 14vw, 12rem)" }}
          >
            RUGA<br />AI.
          </h1>
          <p className="font-mono text-sm text-black/60 mt-3 max-w-md">
            Autonomous prediction agent. Scans 5 sources, runs Groq analysis, then bets its own USDC
            on tokens it believes will rug within 7 days.
          </p>
        </div>

        {/* Agent stats */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10 max-w-2xl">
            <div className="border-2 border-black bg-white px-4 py-4">
              <div className="font-mono text-xs text-black/40 uppercase">Top Picks</div>
              <div className="font-display text-3xl text-black mt-1">{picks.length}</div>
            </div>
            <div className="border-2 border-black bg-white px-4 py-4">
              <div className="font-mono text-xs text-black/40 uppercase">Stakes Placed</div>
              <div className="font-display text-3xl text-black mt-1">{picksWithBet.length}</div>
            </div>
            <div className="border-2 border-black bg-white px-4 py-4">
              <div className="font-mono text-xs text-black/40 uppercase">USDC Deployed</div>
              <div className="font-display text-3xl text-black mt-1">{totalDeployed.toFixed(0)}</div>
            </div>
            <div className="border-2 border-black bg-white px-4 py-4">
              <div className="font-mono text-xs text-black/40 uppercase">Avg Confidence</div>
              <div className="font-display text-3xl text-ruga-red mt-1">{avgConfidence}%</div>
            </div>
          </div>
        )}

        {/* Agent wallet address */}
        {agentAddress && (
          <div className="mb-6 max-w-2xl border-2 border-black bg-white px-4 py-3 flex items-center justify-between gap-4">
            <span className="font-mono text-xs text-black/40 uppercase shrink-0">Agent Wallet</span>
            <span className="font-mono text-xs text-black truncate">{agentAddress}</span>
          </div>
        )}

        {/* Strict criteria callout */}
        <div className="border-2 border-black bg-black text-white px-5 py-4 max-w-2xl mb-8">
          <div className="font-mono text-xs uppercase tracking-widest text-white/40 mb-2">Strict Betting Criteria</div>
          <div className="font-mono text-xs text-white/70 space-y-1">
            <div>✓ Confidence score ≥ 70% (HIGH RISK threshold)</div>
            <div>✓ Confirmed across multiple detection sources</div>
            <div>✓ Token not a stablecoin, wrapped asset, or blue-chip</div>
            <div>✓ Market window active (≤ 7 days)</div>
            <div>✓ Stake sized by conviction: 5 / 10 / 15 USDC</div>
          </div>
        </div>

        {/* Section header */}
        <div className="flex items-baseline gap-4 mb-6">
          <h2 className="font-display text-4xl text-black">TOP PICKS</h2>
          {picks.length > 0 && (
            <span className="font-mono text-xs text-black/40">
              {picks.length} active · all flagged HIGH RISK
            </span>
          )}
        </div>

        {loading ? (
          <p className="font-display text-3xl text-black">ANALYSING<LoadingDots /></p>
        ) : picks.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">NO PICKS YET.</div>
            <p className="font-mono text-sm text-black/60">
              The AI only bets when confidence is ≥ 70%. No tokens currently meet the threshold.
              The agent scans every 5 minutes.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {picks.map((pick) => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>
        )}

        {/* CTA */}
        {!loading && picks.length > 0 && (
          <div className="mt-10 border-t-2 border-black pt-8">
            <p className="font-mono text-sm text-black/60 mb-4">
              Agree with the AI? Place your own bet alongside it.
            </p>
            <Link
              href="/markets"
              className="font-display text-2xl bg-black text-white px-8 py-3 border-2 border-black hover:bg-ruga-dim transition-colors inline-block"
            >
              VIEW ALL MARKETS →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
