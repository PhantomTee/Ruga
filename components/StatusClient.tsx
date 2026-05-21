"use client";

import { useEffect, useState } from "react";
import { Nav } from "./Nav";

type StatusData = {
  lastScanTime: string | null;
  nextScanTime: string | null;
  commitsScannedToday: number;
  signalsFound: number;
  failures: number;
  marketsCreated: number;
  accuracyRate: number;
  reasoningLogs: Array<{
    token: string;
    confidence: number;
    reasoning: string;
    createdAt: string;
  }>;
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      setTick((n) => n + 1);
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
          <div className="space-y-6 max-w-4xl">
            {/* Metric grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Metric label="Last Scan" value={timeAgo(status.lastScanTime)} />
              <Metric label="Next Scan" value={timeUntil(status.nextScanTime)} />
              <Metric label="Commits Today" value={String(status.commitsScannedToday)} />
              <Metric label="Signals Found" value={String(status.signalsFound)} />
              <Metric label="Markets Created" value={String(status.marketsCreated)} />
              <Metric
                label="Accuracy"
                value={status.accuracyRate > 0 ? `${status.accuracyRate}%` : "—"}
                highlight={status.accuracyRate >= 60}
              />
            </div>

            {/* Failures */}
            {status.failures > 0 && (
              <div className="border-2 border-black bg-white p-5">
                <div className="font-display text-xl text-ruga-red mb-2">
                  {status.failures} SCAN FAILURE{status.failures > 1 ? "S" : ""} TODAY
                </div>
                <p className="font-mono text-xs text-black/60">
                  Check GitHub Actions logs for details.
                </p>
              </div>
            )}

            {/* Groq reasoning log */}
            {status.reasoningLogs.length > 0 && (
              <div className="border-2 border-black bg-white">
                <div className="border-b-2 border-black px-5 py-3 font-display text-xl text-black">
                  AI REASONING LOG
                </div>
                <div className="divide-y-2 divide-black max-h-[600px] overflow-y-auto">
                  {status.reasoningLogs.map((log, i) => (
                    <div key={i} className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-display text-2xl text-black">{log.token}</span>
                        <span
                          className={`font-mono text-xs px-2 py-0.5 border border-black ${
                            log.confidence >= 70 ? "bg-black text-white" : "bg-white text-black"
                          }`}
                        >
                          {log.confidence}% confidence
                        </span>
                        <span className="font-mono text-xs text-black/40 ml-auto">
                          {timeAgo(log.createdAt)}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-black/70 leading-5">{log.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="font-mono text-xs text-black/40">
              Auto-refreshes every 30s · tick #{tick}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  highlight
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="border-2 border-black bg-white p-4">
      <div className="font-mono text-xs text-black/40 uppercase">{label}</div>
      <div className={`font-display text-3xl mt-1 ${highlight ? "text-ruga-red" : "text-black"}`}>
        {value}
      </div>
    </div>
  );
}
