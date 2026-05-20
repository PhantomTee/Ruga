"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ruga-red flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5 border-b-2 border-black">
        <span className="font-display text-2xl leading-none">RUGA</span>
        <ConnectKitButton />
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center px-6 py-16">
        <h1 className="font-display leading-none text-black" style={{ fontSize: "clamp(5rem, 22vw, 18rem)" }}>
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
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-black px-6 py-4 flex flex-wrap gap-4 items-center justify-between">
        <span className="font-mono text-xs text-black/50">
          Arc Testnet · {process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.slice(0, 10)}…
        </span>
        <span className="font-mono text-xs text-black/50">
          Signal: iterativv/NostalgiaForInfinity
        </span>
      </footer>
    </main>
  );
}
