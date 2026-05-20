"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { useState } from "react";
import { injected } from "@wagmi/core";
import { walletConnect } from "wagmi/connectors";
import { createConfig, http, WagmiProvider } from "wagmi";
import { defineChain } from "viem";

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

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const config = createConfig({
  chains: [arcTestnet],
  connectors: walletConnectProjectId
    ? [injected(), walletConnect({ projectId: walletConnectProjectId })]
    : [injected()],
  transports: {
    [arcTestnet.id]: http(process.env.NEXT_PUBLIC_ARC_RPC || "")
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          theme="midnight"
          customTheme={{
            "--ck-font-family": "var(--font-jetbrains)",
            "--ck-accent-color": "#00ff41",
            "--ck-accent-text-color": "#0a0a0a",
            "--ck-body-background": "#0a0a0a"
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
