"use client";

import { useEffect, useState } from "react";
import { Nav } from "./Nav";
import { formatUsd, truncateAddress } from "@/lib/format";

type Leader = { wallet: string; won: number };

export function LeaderboardClient() {
  const [leaders, setLeaders] = useState<Leader[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaders(d.leaderboard || []));
  }, []);

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        <h1 className="font-display leading-none text-black mb-10" style={{ fontSize: "clamp(4rem, 14vw, 12rem)" }}>
          LEADER<br />BOARD.
        </h1>
        <div className="max-w-2xl space-y-2">
          {leaders.map((row, i) => (
            <div
              key={row.wallet}
              className="flex items-center gap-4 border-2 border-black bg-white px-5 py-4"
            >
              <span className="font-display text-4xl text-black w-14 shrink-0">
                #{i + 1}
              </span>
              <span className="font-mono text-sm text-black flex-1 truncate">
                {truncateAddress(row.wallet)}
              </span>
              <span className="font-mono font-bold text-black shrink-0">
                ${formatUsd(row.won)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
