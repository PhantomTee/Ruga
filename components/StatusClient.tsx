"use client";

import { useEffect, useState } from "react";
import { Nav } from "./Nav";

type StatusData = {
  lastScanTime: string | null;
  nextScanTime: string | null;
  commitsScannedToday: number;
};

function LoadingDots() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setCount((c) => (c % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);
  return <span>{".".repeat(count)}</span>;
}

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(iso: string | null) {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.ceil(diff / 60_000);
  return `${mins}m`;
}

export function StatusClient() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      fetch("/api/agent/status")
        .then((r) => r.json())
        .then((d) => setStatus(d));
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="min-h-screen bg-ruga-red">
      <Nav />
      <div className="px-6 py-10">
        <h1
          className="font-display leading-none text-black mb-10"
          style={{ fontSize: "clamp(3rem, 12vw, 9rem)" }}
        >
          AGENT<br />STATUS.
        </h1>

        {loading ? (
          <p className="font-display text-3xl text-black">LOADING<LoadingDots /></p>
        ) : !status ? (
          <p className="font-mono text-sm text-black">Failed to load agent status.</p>
        ) : (
          <div className="space-y-2 max-w-2xl">
            <Metric label="Last Scan" value={timeAgo(status.lastScanTime)} />
            <Metric label="Next Scan" value={timeUntil(status.nextScanTime)} />
            <Metric label="Total Scans Today" value={String(status.commitsScannedToday)} />
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border-2 border-black bg-white px-5 py-4 flex items-center justify-between">
      <div className="font-mono text-sm text-black/50 uppercase">{label}</div>
      <div className={`font-display text-3xl ${highlight ? "text-ruga-red" : "text-black"}`}>
        {value}
      </div>
    </div>
  );
}
