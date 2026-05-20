"use client";

import { ConnectKitButton } from "connectkit";
import type { Market } from "./types";
import { noPool, yesPool } from "./types";
import { formatUsd } from "@/lib/format";

export function TopBar({ markets }: { markets: Market[] }) {
  const open = markets.filter((market) => !market.resolved).length;
  const resolved = markets.filter((market) => market.resolved).length;
  const risk = markets.reduce((sum, market) => sum + yesPool(market) + noPool(market), 0);

  return (
    <header className="flex h-14 items-center justify-between border-b border-ruga-line bg-ruga-black px-4">
      <div className="flex items-baseline gap-3">
        <div className="text-2xl font-black tracking-[0.18em] text-ruga-green">RUGA</div>
        <div className="hidden text-xs uppercase text-white/55 sm:block">Bet on rugs before they happen.</div>
      </div>
      <div className="hidden text-xs text-white/70 lg:block">
        {open} MARKETS OPEN / {resolved} MARKETS RESOLVED / ${formatUsd(risk)} USDC AT RISK
      </div>
      <ConnectKitButton />
    </header>
  );
}
