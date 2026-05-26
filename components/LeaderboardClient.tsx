"use client";

import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { formatUsd, truncateAddress } from "@/lib/format";

type Leader = { wallet: string; volume: number; won: number };

function LoadingDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(count)}</span>;
}

export function LeaderboardClient() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaders(d.leaderboard || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        <h1 className="font-display leading-none text-black mb-10" style={{ fontSize: "clamp(4rem, 14vw, 12rem)" }}>
          LEADER<br />BOARD.
        </h1>

        {loading ? (
          <p className="font-display text-3xl text-black">
            LOADING<LoadingDots />
          </p>
        ) : leaders.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">NOBODY YET.</div>
            <p className="font-mono text-sm text-black/60">
              Place bets to appear on the leaderboard. Top bettors by volume are ranked here.
            </p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-2">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-2">
              <span className="w-10 sm:w-14 shrink-0" />
              <span className="font-mono text-xs text-black/40 uppercase flex-1">Wallet</span>
              <span className="font-mono text-xs text-black/40 uppercase w-20 sm:w-28 text-right shrink-0">Volume</span>
              <span className="font-mono text-xs text-black/40 uppercase w-20 text-right shrink-0 hidden sm:block">Winnings</span>
            </div>
            {leaders.map((row, i) => (
              <div
                key={row.wallet}
                className="flex items-center gap-3 border-2 border-black bg-white px-4 py-4"
              >
                <span className="font-display text-2xl sm:text-4xl text-black w-10 sm:w-14 shrink-0">
                  #{i + 1}
                </span>
                <span className="font-mono text-xs sm:text-sm text-black flex-1 truncate">
                  {truncateAddress(row.wallet)}
                </span>
                <span className="font-mono font-bold text-black w-20 sm:w-28 text-right shrink-0 text-xs sm:text-sm">
                  ${formatUsd(row.volume)}
                </span>
                <span className={`font-mono text-xs w-20 text-right shrink-0 hidden sm:block ${row.won > 0 ? "text-black font-bold" : "text-black/30"}`}>
                  {row.won > 0 ? `$${formatUsd(row.won)}` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
