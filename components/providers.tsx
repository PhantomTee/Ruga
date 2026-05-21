"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { useState } from "react";
import { injected } from "wagmi/connectors";
import { createConfig, http, WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import { defineChain } from "viem";
import { ToastProvider } from "./Toast";

const arcChainId = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID);
if (Number.isNaN(arcChainId) || arcChainId === 0) {
  throw new Error("NEXT_PUBLIC_ARC_CHAIN_ID must be set to a valid numeric chain ID");
}

const arcTestnet = defineChain({
  id: arcChainId,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ARC_RPC || ""] }
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://testnet.arcscan.app" }
  },
  testnet: true
});

const config = createConfig({
  chains: [arcTestnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(process.env.NEXT_PUBLIC_ARC_RPC || ""),
    // Provide a CORS-friendly public RPC for mainnet so ConnectKit's ENS
    // resolution doesn't fall back to eth.merkle.io (which blocks cross-origin requests)
    [mainnet.id]: http("https://eth.llamarpc.com"),
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't retry on failure — prevents CORS error spam in the console
            // when ConnectKit tries to fetch ENS/avatar data
            retry: false,
            staleTime: 30_000,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          customTheme={{
            "--ck-font-family": "var(--font-jetbrains)",
            "--ck-accent-color": "#000000",
            "--ck-accent-text-color": "#FFFFFF",
            "--ck-body-background": "#FFFFFF",
            "--ck-body-color": "#000000",
            "--ck-border-radius": "0px",
            "--ck-overlay-background": "rgba(0,0,0,0.6)"
          }}
        >
          <ToastProvider>{children}</ToastProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
