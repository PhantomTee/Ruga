"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type State = "idle" | "loading" | "exists" | "created" | "error";

export function CreateMarketModal({ onClose }: { onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [state, setState] = useState<State>("idle");
  const [marketId, setMarketId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  async function submit() {
    const s = symbol.trim();
    if (!s || state === "loading") return;
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/markets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: s }),
      });
      const data = await res.json() as { exists?: boolean; created?: boolean; marketId?: number; error?: string };
      if (!res.ok || data.error) {
        setState("error");
        setErrorMsg(data.error || "Something went wrong");
        return;
      }
      setMarketId(data.marketId ?? null);
      setState(data.exists ? "exists" : "created");
    } catch {
      setState("error");
      setErrorMsg("Network error — try again");
    }
  }

  function goToMarket() {
    if (marketId !== null) { onClose(); router.push(`/market/${marketId}`); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="border-2 border-black bg-ruga-red w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b-2 border-black px-5 py-4 flex items-center justify-between">
          <div className="font-display text-2xl text-black">FLAG A TOKEN</div>
          <button onClick={onClose} className="font-mono text-sm text-black/50 hover:text-black">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {(state === "idle" || state === "loading" || state === "error") && (
            <>
              <div>
                <label className="font-mono text-xs text-black/60 uppercase block mb-2">
                  Token Symbol
                </label>
                <input
                  className="w-full border-2 border-black bg-white px-3 py-3 font-display text-2xl text-black uppercase outline-none placeholder:text-black/20"
                  placeholder="e.g. PEPE"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  maxLength={12}
                  autoFocus
                  disabled={state === "loading"}
                />
                <p className="font-mono text-xs text-black/40 mt-1">
                  Think it&apos;ll rug? Flag it and a 7-day prediction market opens instantly.
                </p>
              </div>

              {state === "error" && (
                <div className="border-2 border-black bg-white p-3 font-mono text-xs text-black">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={submit}
                disabled={!symbol.trim() || state === "loading"}
                className="w-full border-2 border-black bg-black text-white py-3 font-display text-2xl hover:bg-ruga-dim transition-colors disabled:opacity-40 disabled:cursor-wait"
              >
                {state === "loading" ? "CREATING…" : "CREATE MARKET →"}
              </button>
            </>
          )}

          {state === "exists" && (
            <div className="space-y-3">
              <div className="border-2 border-black bg-white p-5">
                <div className="font-display text-2xl text-black mb-2">ALREADY EXISTS.</div>
                <p className="font-mono text-sm text-black/60">
                  A market for <span className="font-bold text-black">${symbol}</span> is already
                  live. Head there to place your bet.
                </p>
              </div>
              <button
                onClick={goToMarket}
                className="w-full border-2 border-black bg-black text-white py-3 font-display text-2xl hover:bg-ruga-dim transition-colors"
              >
                GO TO MARKET →
              </button>
            </div>
          )}

          {state === "created" && (
            <div className="space-y-3">
              <div className="border-2 border-black bg-white p-5">
                <div className="font-display text-2xl text-black mb-2">MARKET OPEN.</div>
                <p className="font-mono text-sm text-black/60">
                  <span className="font-bold text-black">${symbol}</span> is now live. 7 days to
                  find out if it rugs.
                </p>
              </div>
              <button
                onClick={goToMarket}
                className="w-full border-2 border-black bg-black text-white py-3 font-display text-2xl hover:bg-ruga-dim transition-colors"
              >
                BET NOW →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
