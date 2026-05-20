"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = {
  lastScanTime: string | null;
  nextScanTime: string | null;
  commitsScannedToday: number;
  signalsFound: number;
  failures: number;
  marketsCreated: number;
  accuracyRate: number;
  reasoningLogs: Array<{ token: string; confidence: number; reasoning: string; createdAt: string }>;
};

export function AgentStatusClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/agent/status", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load agent status");
    setStatus(payload);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load agent status"));
    const timer = window.setInterval(() => load().catch(() => undefined), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="terminal-grid min-h-screen bg-ruga-black p-4 text-white">
      <Link className="mb-4 inline-block text-sm text-ruga-green" href="/">{"<-"} RUGA</Link>
      <h1 className="text-4xl font-black text-ruga-green">AGENT STATUS</h1>
      {error ? <div className="mt-4 border border-ruga-red bg-ruga-red/10 p-4 text-ruga-red">{error}</div> : null}
      {!status && !error ? <div className="mt-6 border border-ruga-line bg-black p-4 text-sm text-white/55">Loading agent heartbeat...</div> : null}
      {status ? (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <Metric label="Last Scan" value={status.lastScanTime ? new Date(status.lastScanTime).toLocaleTimeString() : "N/A"} />
            <Metric label="Next Scan" value={status.nextScanTime ? new Date(status.nextScanTime).toLocaleTimeString() : "N/A"} />
            <Metric label="Commits Today" value={String(status.commitsScannedToday)} />
            <Metric label="Signals" value={String(status.signalsFound)} />
            <Metric label="Failures" value={String(status.failures)} />
            <Metric label="Accuracy" value={`${status.accuracyRate}%`} />
          </div>
          <section className="mt-6 border border-ruga-line bg-black">
            <div className="border-b border-ruga-line p-3 text-sm font-black text-ruga-green">RECENT GROQ REASONING LOGS</div>
            <div className="divide-y divide-ruga-line">
              {status.reasoningLogs.map((log, index) => (
                <div key={`${log.token}-${index}`} className="p-4 text-sm">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="text-ruga-green">{log.token} / {log.confidence}%</span>
                    <span className="text-white/45">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-white/70">{log.reasoning}</p>
                </div>
              ))}
              {status.reasoningLogs.length === 0 ? <div className="p-4 text-sm text-white/45">No reasoning logs stored yet.</div> : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ruga-line bg-ruga-panel p-4">
      <div className="text-[10px] uppercase text-white/45">{label}</div>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  );
}
