import type { BrowserProvider } from "ethers";
import { ARC_CHAIN_ID } from "./constants";

export function getArcChainId() {
  if (!Number.isSafeInteger(ARC_CHAIN_ID) || ARC_CHAIN_ID <= 0) {
    throw new Error("NEXT_PUBLIC_ARC_CHAIN_ID must be a valid numeric chain ID");
  }
  return ARC_CHAIN_ID;
}

export async function assertArcWalletNetwork(provider: BrowserProvider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== getArcChainId()) {
    throw new Error("Switch wallet to Arc Testnet before continuing");
  }
}

export async function assertContractDeployed(provider: BrowserProvider, address: string, label: string) {
  const code = await provider.getCode(address);
  if (code === "0x") {
    throw new Error(`${label} is not deployed on the active Arc Testnet network`);
  }
}
