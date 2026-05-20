"use client";

import confetti from "canvas-confetti";
import { BrowserProvider, Contract, MaxUint256, parseUnits, type Eip1193Provider } from "ethers";
import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ERC20_ABI, RUGA_MARKET_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, USDC_ADDRESS } from "@/lib/constants";
import type { Market } from "./types";
import { marketSymbol } from "./types";

type Step = "idle" | "approving" | "betting" | "recording" | "done";

export function BetModal({
  market,
  side,
  onClose,
  onSuccess
}: {
  market: Market;
  side: "yes" | "no";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [amount, setAmount] = useState("10");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  async function placeBet() {
    try {
      setError(null);
      if (!address) throw new Error("Connect a wallet before betting");
      if (!walletClient) throw new Error("No active wallet client found");
      if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not configured");
      if (!USDC_ADDRESS) throw new Error("NEXT_PUBLIC_USDC_ADDRESS is not configured");
      if (!/^\d+(\.\d{1,6})?$/.test(amount.trim()) || Number(amount) <= 0) {
        throw new Error("Enter a valid amount (numbers only, max 6 decimal places)");
      }

      const parsed = parseUnits(amount.trim(), 6);
      const provider = new BrowserProvider(walletClient.transport as Eip1193Provider);
      const signer = await provider.getSigner();
      const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const ruga = new Contract(CONTRACT_ADDRESS, RUGA_MARKET_ABI, signer);

      const allowance = await usdc.allowance(address, CONTRACT_ADDRESS);
      if (allowance < parsed) {
        setStep("approving");
        const approveTx = await usdc.approve(CONTRACT_ADDRESS, MaxUint256);
        await approveTx.wait();
      }

      setStep("betting");
      const tx = side === "yes" ? await ruga.betYes(market.on_chain_id || market.id, parsed) : await ruga.betNo(market.on_chain_id || market.id, parsed);
      const receipt = await tx.wait();

      setStep("recording");
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          side,
          amount,
          txHash: receipt.hash,
          walletAddress: address
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to record bet");

      setStep("done");
      confetti({ particleCount: 140, spread: 70, origin: { y: 0.72 }, colors: ["#00ff41", "#ff3131", "#ffffff"] });
      onSuccess();
    } catch (err) {
      const rejected =
        typeof err === "object" &&
        err !== null &&
        ("code" in err || "info" in err) &&
        JSON.stringify(err).includes("4001");
      setError(rejected ? "Transaction rejected in wallet" : err instanceof Error ? err.message : "Bet failed");
      setStep("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md border border-ruga-line bg-ruga-black shadow-[0_0_40px_rgba(0,255,65,0.12)]">
        <div className="flex items-center justify-between border-b border-ruga-line px-4 py-3">
          <div>
            <div className="text-xs uppercase text-white/50">Place wager</div>
            <div className="text-xl font-black text-white">
              {marketSymbol(market)} / <span className={side === "yes" ? "text-ruga-green" : "text-ruga-red"}>{side.toUpperCase()}</span>
            </div>
          </div>
          <button className="border border-ruga-line px-3 py-1 text-white/70 hover:text-white" onClick={onClose}>
            X
          </button>
        </div>
        <div className="space-y-4 p-4">
          <label className="block text-xs uppercase text-white/50">USDC Amount</label>
          <input
            className="w-full border border-ruga-line bg-black px-3 py-3 text-xl text-white outline-none focus:border-ruga-green"
            value={amount}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
          />
          <button
            disabled={step !== "idle"}
            onClick={placeBet}
            className={`w-full px-4 py-3 font-black uppercase text-black disabled:cursor-wait disabled:opacity-70 ${
              side === "yes" ? "bg-ruga-green" : "bg-ruga-red"
            }`}
          >
            {step === "idle" && `Bet ${side}`}
            {step === "approving" && "Step 1: Approve USDC"}
            {step === "betting" && "Step 2: Placing Bet"}
            {step === "recording" && "Recording Bet"}
            {step === "done" && "Bet Placed"}
          </button>
          {error ? <div className="border border-ruga-red bg-ruga-red/10 p-3 text-sm text-ruga-red">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
