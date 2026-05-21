"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useModal } from "connectkit";
import { BrowserProvider, Contract, Interface, type Eip1193Provider } from "ethers";
import { RUGA_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, PRICE_SCALE } from "@/lib/constants";

type TokenInfo = {
  symbol: string;
  name: string;
  priceUsd: number;
  liquidity: number;
  volume24h: number;
  chain: string;
  pairAddress: string;
  tokenAddress: string;
  coinId: string | null;
};

type State =
  | "idle"
  | "looking"
  | "preview"
  | "exists"
  | "signing"
  | "confirming"
  | "registering"
  | "created"
  | "error";

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function CreateMarketModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>("idle");
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [existingMarketId, setExistingMarketId] = useState<number | null>(null);
  const [createdMarketId, setCreatedMarketId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { setOpen: openConnectKit } = useModal();
  const router = useRouter();

  async function lookup() {
    const raw = url.trim();
    if (!raw || state === "looking") return;
    setState("looking");
    setErrorMsg("");
    setToken(null);

    try {
      const res = await fetch(`/api/markets/lookup?url=${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setState("error");
        setErrorMsg(data.error || "Lookup failed");
        return;
      }
      if (data.exists) {
        setExistingMarketId(data.marketId);
        setState("exists");
        return;
      }
      setToken(data as TokenInfo);
      setState("preview");
    } catch {
      setState("error");
      setErrorMsg("Network error — try again");
    }
  }

  async function createMarket() {
    if (!token) return;
    if (!address) { openConnectKit(true); return; }
    if (!walletClient) { setErrorMsg("No wallet connected"); return; }
    if (!CONTRACT_ADDRESS) { setErrorMsg("Contract address not configured"); return; }

    setState("signing");
    setErrorMsg("");

    try {
      const priceScaled = BigInt(Math.round(token.priceUsd * PRICE_SCALE));

      // User signs the createMarket TX
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, RUGA_MARKET_ABI, signer);

      const tx = await contract.createMarket(
        token.symbol,
        token.name,
        token.coinId ?? token.symbol,
        priceScaled
      );

      setState("confirming");
      const receipt = await tx.wait();

      // Parse MarketCreated event for the market ID
      const iface = new Interface(RUGA_MARKET_ABI);
      let marketId: number | null = null;
      let resolvesAt: string | null = null;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "MarketCreated") {
            marketId = Number(parsed.args.id);
            resolvesAt = new Date(Number(parsed.args.resolvesAt) * 1000).toISOString();
            break;
          }
        } catch { /* skip */ }
      }

      setState("registering");

      // Register in Supabase
      const regRes = await fetch("/api/markets/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: receipt.hash,
          walletAddress: address,
          symbol: token.symbol,
          name: token.name,
          coinId: token.coinId,
          priceScaled: priceScaled.toString(),
          pairAddress: token.pairAddress,
          chain: token.chain,
          resolvesAt,
          marketId,
        }),
      });

      const regData = await regRes.json();
      if (!regRes.ok || regData.error) {
        setState("error");
        setErrorMsg(regData.error || "Failed to register market");
        return;
      }

      setCreatedMarketId(regData.marketId ?? marketId);
      setState("created");
    } catch (err) {
      const raw = JSON.stringify(err);
      const rejected = raw.includes("4001") || raw.includes("rejected") || raw.includes("denied");
      setState("error");
      setErrorMsg(rejected ? "Transaction rejected in wallet" : err instanceof Error ? err.message : "Transaction failed");
    }
  }

  function goToMarket(id: number | null) {
    onClose();
    if (id !== null) router.push(`/market/${id}`);
    else router.push("/markets");
  }

  const statusLabel =
    state === "signing" ? "WAITING FOR SIGNATURE…" :
    state === "confirming" ? "CONFIRMING ON-CHAIN…" :
    state === "registering" ? "REGISTERING MARKET…" :
    state === "looking" ? "LOOKING UP TOKEN…" : "";

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
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

          {/* URL input — shown in idle / error / preview states */}
          {(state === "idle" || state === "error" || state === "preview") && (
            <div>
              <label className="font-mono text-xs text-black/60 uppercase block mb-2">
                DexScreener Link or Token Address
              </label>
              <input
                className="w-full border-2 border-black bg-white px-3 py-3 font-mono text-sm text-black outline-none placeholder:text-black/25 break-all"
                placeholder="https://dexscreener.com/solana/abc… or 0x…"
                value={url}
                onChange={(e) => { setUrl(e.target.value); if (state === "error") { setState("idle"); setErrorMsg(""); } }}
                onKeyDown={(e) => e.key === "Enter" && lookup()}
                autoFocus={state === "idle"}
              />
              <p className="font-mono text-xs text-black/40 mt-1">
                Works with any chain — Solana, Ethereum, BSC, Base, etc.
              </p>
            </div>
          )}

          {/* Error */}
          {state === "error" && errorMsg && (
            <div className="border-2 border-black bg-white p-3 font-mono text-xs text-black">
              {errorMsg}
            </div>
          )}

          {/* Lookup button */}
          {(state === "idle" || state === "error") && (
            <button
              onClick={lookup}
              disabled={!url.trim()}
              className="w-full border-2 border-black bg-black text-white py-3 font-display text-2xl hover:bg-ruga-dim transition-colors disabled:opacity-40"
            >
              LOOK UP TOKEN →
            </button>
          )}

          {/* Loading spinner states */}
          {(state === "looking" || state === "signing" || state === "confirming" || state === "registering") && (
            <div className="border-2 border-black bg-white p-6 text-center space-y-3">
              <div className="font-display text-2xl text-black animate-pulse">{statusLabel}</div>
              {(state === "signing") && (
                <p className="font-mono text-xs text-black/50">Check your wallet for the signature request</p>
              )}
              {(state === "confirming") && (
                <p className="font-mono text-xs text-black/50">Waiting for block confirmation on Arc…</p>
              )}
            </div>
          )}

          {/* Token preview */}
          {state === "preview" && token && (
            <>
              <div className="border-2 border-black bg-white p-5 space-y-4">
                {/* Token header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-5xl leading-none text-black">{token.symbol}</div>
                    <div className="font-mono text-xs text-black/50 mt-1">{token.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-black/40 uppercase">Price</div>
                    <div className="font-display text-2xl text-black">
                      ${token.priceUsd < 0.001
                        ? token.priceUsd.toExponential(3)
                        : token.priceUsd.toFixed(6)}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="border border-black/10 p-2">
                    <div className="font-mono text-[10px] text-black/40 uppercase">Liquidity</div>
                    <div className="font-mono text-sm font-bold text-black">{fmtUsd(token.liquidity)}</div>
                  </div>
                  <div className="border border-black/10 p-2">
                    <div className="font-mono text-[10px] text-black/40 uppercase">24h Vol</div>
                    <div className="font-mono text-sm font-bold text-black">{fmtUsd(token.volume24h)}</div>
                  </div>
                  <div className="border border-black/10 p-2">
                    <div className="font-mono text-[10px] text-black/40 uppercase">Chain</div>
                    <div className="font-mono text-sm font-bold text-black uppercase">{token.chain}</div>
                  </div>
                </div>

                {token.coinId && (
                  <div className="font-mono text-xs text-black/40">
                    ✓ CoinGecko verified — price chart will be available
                  </div>
                )}
                {!token.coinId && (
                  <div className="font-mono text-xs text-black/30">
                    Not on CoinGecko — chart data may be limited
                  </div>
                )}
              </div>

              {/* Create button */}
              {!address ? (
                <button
                  onClick={() => openConnectKit(true)}
                  className="w-full border-2 border-black bg-black text-white py-3 font-display text-2xl hover:bg-ruga-dim transition-colors"
                >
                  CONNECT WALLET →
                </button>
              ) : (
                <button
                  onClick={createMarket}
                  className="w-full border-2 border-black bg-black text-white py-4 font-display text-2xl hover:bg-ruga-red hover:text-black transition-colors"
                >
                  SIGN & CREATE MARKET →
                </button>
              )}
              <p className="font-mono text-xs text-black/40 text-center">
                You&apos;ll sign one gas-only transaction. No USDC required.
              </p>
            </>
          )}

          {/* Already exists */}
          {state === "exists" && (
            <div className="space-y-3">
              <div className="border-2 border-black bg-white p-5">
                <div className="font-display text-2xl text-black mb-2">ALREADY EXISTS.</div>
                <p className="font-mono text-sm text-black/60">
                  A market for this token is already live. Head there to place your bet.
                </p>
              </div>
              <button
                onClick={() => goToMarket(existingMarketId)}
                className="w-full border-2 border-black bg-black text-white py-3 font-display text-2xl hover:bg-ruga-dim transition-colors"
              >
                GO TO MARKET →
              </button>
            </div>
          )}

          {/* Success */}
          {state === "created" && token && (
            <div className="space-y-3">
              <div className="border-2 border-black bg-white p-5">
                <div className="font-display text-4xl text-black mb-2">MARKET OPEN.</div>
                <p className="font-mono text-sm text-black/60">
                  <span className="font-bold text-black">${token.symbol}</span> is now live on-chain.
                  7 days to find out if it rugs.
                </p>
                {createdMarketId !== null && (
                  <div className="font-mono text-xs text-black/30 mt-2">Market #{createdMarketId}</div>
                )}
              </div>
              <button
                onClick={() => goToMarket(createdMarketId)}
                className="w-full border-2 border-black bg-black text-white py-3 font-display text-2xl hover:bg-ruga-dim transition-colors"
              >
                {createdMarketId !== null ? "BET NOW →" : "VIEW MARKETS →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
