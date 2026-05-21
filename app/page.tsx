"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

function RugMascot() {
  return (
    <svg
      viewBox="0 0 320 380"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      style={{ filter: "drop-shadow(4px 6px 0px #000)" }}
    >
      <path d="M60 230 Q55 310 50 370 L270 370 Q265 310 260 230 Q240 200 200 195 L160 210 L120 195 Q80 200 60 230Z" fill="#000" stroke="#000" strokeWidth="3" />
      <rect x="115" y="295" width="90" height="55" rx="6" fill="#1a1a1a" stroke="#333" strokeWidth="2" />
      <line x1="145" y1="230" x2="135" y2="295" stroke="#333" strokeWidth="3" strokeLinecap="round" />
      <line x1="175" y1="230" x2="185" y2="295" stroke="#333" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="160" cy="155" rx="90" ry="95" fill="#FFFFFF" stroke="#000" strokeWidth="5" />
      <path d="M75 170 Q60 120 80 80 Q110 30 160 25 Q210 30 240 80 Q260 120 245 170" fill="none" stroke="#000" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="125" cy="148" rx="22" ry="24" fill="#FF1515" stroke="#000" strokeWidth="4" />
      <ellipse cx="125" cy="148" rx="12" ry="13" fill="#000" />
      <ellipse cx="120" cy="142" rx="5" ry="5" fill="#FFF" />
      <ellipse cx="195" cy="148" rx="22" ry="24" fill="#FF1515" stroke="#000" strokeWidth="4" />
      <ellipse cx="195" cy="148" rx="12" ry="13" fill="#000" />
      <ellipse cx="190" cy="142" rx="5" ry="5" fill="#FFF" />
      <path d="M103 122 Q125 112 147 118" stroke="#000" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M173 118 Q195 112 217 122" stroke="#000" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M155 165 Q160 180 165 165" stroke="#000" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M115 195 Q160 225 205 195" stroke="#000" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M125 200 Q160 220 195 200 L195 210 Q160 232 125 210Z" fill="#FF1515" stroke="#000" strokeWidth="3" />
      <rect x="136" y="202" width="16" height="12" rx="2" fill="#FFF" stroke="#000" strokeWidth="2" />
      <rect x="154" y="202" width="16" height="12" rx="2" fill="#FFF" stroke="#000" strokeWidth="2" />
      <rect x="172" y="202" width="14" height="12" rx="2" fill="#FFF" stroke="#000" strokeWidth="2" />
      <path d="M230 130 Q238 118 232 108 Q224 118 230 130Z" fill="#4499FF" stroke="#000" strokeWidth="2" />
      <circle cx="160" cy="323" r="18" fill="#FFD700" stroke="#000" strokeWidth="3" />
      <text x="160" y="329" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#000">$</text>
      <rect x="154" y="302" width="12" height="8" rx="3" fill="#FFD700" stroke="#000" strokeWidth="2" />
      <line x1="92" y1="158" x2="108" y2="165" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="90" y1="168" x2="106" y2="172" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="212" y1="158" x2="228" y2="165" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="214" y1="168" x2="230" y2="172" stroke="#000" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

type Stats = { totalMarkets: number; totalWagered: number; uniqueBettors: number; totalBets: number };

export default function LandingPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-ruga-red flex flex-col">
      <Nav />

      {/* Stats bar */}
      {stats && (
        <div className="border-b-2 border-black bg-black px-6 py-2 flex flex-wrap gap-x-8 gap-y-1 items-center">
          <span className="font-mono text-xs text-white/60">
            <span className="text-white font-bold">{stats.totalMarkets}</span> MARKETS
          </span>
          <span className="font-mono text-xs text-white/60">
            <span className="text-white font-bold">{stats.totalBets}</span> BETS PLACED
          </span>
          <span className="font-mono text-xs text-white/60">
            <span className="text-white font-bold">${stats.totalWagered.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> WAGERED
          </span>
          <span className="font-mono text-xs text-white/60">
            <span className="text-white font-bold">{stats.uniqueBettors}</span> BETTORS
          </span>
          <span className="font-mono text-xs text-ruga-red ml-auto">● LIVE ON ARC TESTNET</span>
        </div>
      )}

      {/* Hero */}
      <section className="flex-1 flex flex-col lg:flex-row items-center justify-between px-6 py-10 gap-8">
        <div className="flex flex-col justify-center max-w-2xl">
          <h1
            className="font-display leading-none text-black"
            style={{ fontSize: "clamp(4.5rem, 20vw, 16rem)" }}
          >
            RUGA
          </h1>
          <p className="font-display text-3xl sm:text-5xl text-black mt-2">
            BET ON THE RUG.
          </p>
          <p className="font-mono text-sm text-black/60 mt-4 max-w-sm">
            AI-powered prediction markets. A token gets blacklisted — you bet
            whether it rugs within 7 days.
          </p>
          <div className="flex flex-wrap gap-3 mt-10">
            <Link
              href="/markets"
              className="font-display text-2xl bg-black text-white px-8 py-3 border-2 border-black hover:bg-ruga-dim transition-colors"
            >
              MARKETS →
            </Link>
            <Link
              href="/leaderboard"
              className="font-display text-2xl bg-ruga-red text-black px-8 py-3 border-2 border-black hover:bg-black hover:text-white transition-colors"
            >
              LEADERBOARD
            </Link>
          </div>
        </div>

        <div className="w-56 sm:w-72 lg:w-80 shrink-0 select-none">
          <RugMascot />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t-2 border-black bg-black px-6 py-12">
        <div className="font-display text-xl text-white/40 mb-8 tracking-widest">HOW IT WORKS</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 max-w-4xl">
          {[
            {
              n: "01",
              title: "AI SCANS",
              body: "5 sources — GitHub blacklists, RugCheck, DexScreener, GoPlusSecurity — flag suspicious tokens every 5 minutes."
            },
            {
              n: "02",
              title: "MARKET OPENS",
              body: "Groq validates the signal. If confidence > 70%, a 7-day prediction market opens on-chain on Arc testnet."
            },
            {
              n: "03",
              title: "YOU BET",
              body: "YES = token rugs (−80% price). NO = it survives. Winners split the losing pool. 2% protocol fee."
            }
          ].map((step, i) => (
            <div
              key={step.n}
              className={`p-8 ${i < 2 ? "sm:border-r-2 border-white/10" : ""} border-b-2 sm:border-b-0 border-white/10`}
            >
              <div className="font-mono text-4xl text-ruga-red mb-4">{step.n}</div>
              <div className="font-display text-3xl text-white mb-3">{step.title}</div>
              <p className="font-mono text-sm text-white/50 leading-6">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <span className="font-mono text-xs text-black/50">
          Arc Testnet · {process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.slice(0, 10)}…
        </span>
        <span className="font-mono text-xs text-black/50">
          5 detection sources · scans every 5 min
        </span>
      </footer>
    </main>
  );
}
