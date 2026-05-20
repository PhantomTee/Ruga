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
      const tx = side === "yes"
        ? await ruga.betYes(market.on_chain_id || market.id, parsed)
        : await ruga.betNo(market.on_chain_id || market.id, parsed);
      const receipt = await tx.wait();

      setStep("recording");
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marketId: market.id, side, amount, txHash: receipt.hash, walletAddress: address })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to record bet");

      setStep("done");
      confetti({ particleCount: 140, spread: 70, origin: { y: 0.72 }, colors: ["#FF1515", "#000000", "#FFFFFF"] });
      onSuccess();
    } catch (err) {
      const rejected =
        typeof err === "object" && err !== null && JSON.stringify(err).includes("4001");
      setError(rejected ? "Transaction rejected in wallet" : err instanceof Error ? err.message : "Bet failed");
      setStep("idle");
    }
  }

  const sideLabel = side.toUpperCase();
  const isYes = side === "yes";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm border-2 border-black bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black px-5 py-4">
          <div>
            <div className="font-mono text-xs text-black/40 uppercase">Place wager</div>
            <div className="font-display text-3xl text-black leading-none mt-1">
              {marketSymbol(market)} / <span className={isYes ? "text-black" : "text-ruga-red"}>{sideLabel}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="border-2 border-black w-9 h-9 flex items-center justify-center font-mono text-sm hover:bg-black hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="font-mono text-xs text-black/40 uppercase block mb-2">USDC Amount</label>
            <input
              className="w-full border-2 border-black px-3 py-3 font-display text-3xl text-black bg-white outline-none focus:border-black placeholder:text-black/20"
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
            />
          </div>

          <button
            disabled={step !== "idle"}
            onClick={placeBet}
            className={`w-full py-4 font-display text-2xl border-2 border-black transition-colors disabled:opacity-50 disabled:cursor-wait ${
              isYes
                ? "bg-black text-white hover:bg-ruga-red hover:text-black"
                : "bg-ruga-red text-black hover:bg-black hover:text-white"
            }`}
          >
            {step === "idle" && `BET ${sideLabel}`}
            {step === "approving" && "APPROVING USDC…"}
            {step === "betting" && "PLACING BET…"}
            {step === "recording" && "RECORDING…"}
            {step === "done" && "BET PLACED ✓"}
          </button>

          {error && (
            <div className="border-2 border-black bg-ruga-red/10 px-4 py-3 font-mono text-xs text-black">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
