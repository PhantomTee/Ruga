"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Nav } from "./Nav";
import { formatUsd, timeAgoShort, truncateAddress } from "@/lib/format";
import { useAccount } from "wagmi";

type ActivityItem = {
  id: string;
  market_id: number;
  wallet_address: string;
  side: "yes" | "no";
  amount: string | number;
  created_at: string;
  token_symbol: string;
  token_name: string | null;
};

function LoadingDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(count)}</span>;
}

export function ActivityClient() {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());
  const { address } = useAccount();

  const load = useCallback(() => {
    return fetch(`/api/activity?limit=50&ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" }
    })
      .then((r) => r.json())
      .then((d) => {
        const items: ActivityItem[] = d.activity || [];
        // Detect newly appeared items for flash animation
        const incoming = new Set(items.map((i) => i.id));
        const fresh = new Set([...incoming].filter((id) => !prevIds.current.has(id)));
        if (prevIds.current.size > 0 && fresh.size > 0) {
          setNewIds(fresh);
          setTimeout(() => setNewIds(new Set()), 2000);
        }
        prevIds.current = incoming;
        setActivity(items);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const onRefresh = () => load();
    const t = setInterval(onRefresh, 5_000);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("ruga:bet-recorded", onRefresh);
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("ruga-live") : null;
    if (channel) {
      channel.onmessage = (event) => {
        if (event.data?.type === "bet-recorded") onRefresh();
      };
    }
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("ruga:bet-recorded", onRefresh);
      channel?.close();
    };
  }, [load]);

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        <div className="flex items-end justify-between gap-4 mb-10">
          <h1 className="font-display leading-none text-black" style={{ fontSize: "clamp(3rem, 12vw, 9rem)" }}>
            LIVE<br />FEED.
          </h1>
          <div className="font-mono text-xs text-black/50 self-end mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-black animate-pulse inline-block" />
            updates every 5s
          </div>
        </div>

        {loading ? (
          <p className="font-display text-3xl text-black">LOADING<LoadingDots /></p>
        ) : activity.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 max-w-lg">
            <div className="font-display text-4xl text-black mb-3">NO BETS YET.</div>
            <p className="font-mono text-sm text-black/60">
              Be the first. Go place a bet on an open market.
            </p>
          </div>
        ) : (
          <div className="border-2 border-black bg-white divide-y-2 divide-black max-w-3xl">
            {activity.map((item) => {
              const isMe = address && item.wallet_address.toLowerCase() === address.toLowerCase();
              const isNew = newIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-5 py-4 transition-colors ${isNew ? "bg-ruga-red/10" : ""}`}
                >
                  {/* Side badge */}
                  <div
                    className={`font-display text-xl w-14 shrink-0 ${
                      item.side === "yes" ? "text-black" : "text-ruga-red"
                    }`}
                  >
                    {item.side.toUpperCase()}
                  </div>

                  {/* Address */}
                  <div className="font-mono text-xs text-black/60 truncate min-w-0 flex-1">
                    {isMe ? (
                      <span className="text-black font-bold">you</span>
                    ) : (
                      truncateAddress(item.wallet_address)
                    )}{" "}
                    bet on{" "}
                    <Link
                      href={`/market/${item.market_id}`}
                      className="font-bold text-black underline underline-offset-2 hover:text-ruga-red"
                    >
                      ${item.token_symbol}
                    </Link>
                  </div>

                  {/* Amount */}
                  <div className="font-mono text-sm font-bold text-black shrink-0">
                    {formatUsd(item.amount)} USDC
                  </div>

                  {/* Time */}
                  <div className="font-mono text-xs text-black/30 shrink-0 hidden sm:block">
                    {timeAgoShort(item.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
