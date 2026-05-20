import { Contract, Interface, JsonRpcProvider, Wallet, formatUnits } from "ethers";
import { ARC_RPC, CONTRACT_ADDRESS } from "./constants";
import { RUGA_MARKET_ABI } from "./abi";

let provider: JsonRpcProvider | null = null;
let agentContract: Contract | null = null;

export function getProvider() {
  if (!ARC_RPC) throw new Error("NEXT_PUBLIC_ARC_RPC is required");
  if (!provider) provider = new JsonRpcProvider(ARC_RPC);
  return provider;
}

export function getReadContract() {
  if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is required");
  return new Contract(CONTRACT_ADDRESS, RUGA_MARKET_ABI, getProvider());
}

export function getAgentContract() {
  if (agentContract) return agentContract;
  if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is required");
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) throw new Error("AGENT_PRIVATE_KEY is required");
  agentContract = new Contract(CONTRACT_ADDRESS, RUGA_MARKET_ABI, new Wallet(key, getProvider()));
  return agentContract;
}

export async function createOnChainMarket(input: {
  symbol: string;
  name: string;
  coingeckoId: string;
  priceScaled: bigint;
}) {
  const contract = getAgentContract();
  const tx = await contract.createMarket(input.symbol, input.name, input.coingeckoId, input.priceScaled);
  const receipt = await tx.wait();
  const iface = new Interface(RUGA_MARKET_ABI);
  let marketId: bigint | null = null;
  let resolvesAt: bigint | null = null;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "MarketCreated") {
        marketId = parsed.args.id;
        resolvesAt = parsed.args.resolvesAt;
        break;
      }
    } catch {
      // Ignore logs from other contracts.
    }
  }

  if (marketId === null) {
    marketId = await contract.marketCount();
  }

  return {
    txHash: receipt.hash,
    marketId: Number(marketId),
    resolvesAt: resolvesAt ? new Date(Number(resolvesAt) * 1000).toISOString() : null
  };
}

export async function resolveOnChainMarket(marketId: number, rugged: boolean) {
  const contract = getAgentContract();
  const tx = await contract.resolveMarket(marketId, rugged);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function getOnChainMarket(marketId: number, user?: string) {
  const contract = getReadContract();
  const data = await contract.getMarket(marketId);
  const userBets = user ? await contract.getUserBets(marketId, user) : null;

  return {
    id: Number(data.id),
    tokenSymbol: data.tokenSymbol as string,
    tokenName: data.tokenName as string,
    coingeckoId: data.coingeckoId as string,
    createdAt: new Date(Number(data.createdAt) * 1000).toISOString(),
    resolvesAt: new Date(Number(data.resolvesAt) * 1000).toISOString(),
    yesPool: formatUnits(data.yesPool, 6),
    noPool: formatUnits(data.noPool, 6),
    resolved: Boolean(data.resolved),
    outcome: Boolean(data.outcome),
    priceAtCreation: Number(data.priceAtCreation) / 100_000_000,
    userBets: userBets
      ? { yes: formatUnits(userBets.yes, 6), no: formatUnits(userBets.no, 6) }
      : undefined
  };
}

export async function verifyBetTransaction(txHash: string, expectedWallet: string) {
  const receipt = await getProvider().getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) throw new Error("Transaction was not found or failed on Arc");
  if (receipt.from.toLowerCase() !== expectedWallet.toLowerCase()) {
    throw new Error("Transaction sender does not match walletAddress");
  }
  if (!CONTRACT_ADDRESS || receipt.to?.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
    throw new Error("Transaction did not target the RugaMarket contract");
  }
  return receipt;
}

export async function verifyBetTransactionDetails(input: {
  txHash: string;
  expectedWallet: string;
  marketId: number;
  side: "yes" | "no";
  amount: bigint;
}) {
  const receipt = await verifyBetTransaction(input.txHash, input.expectedWallet);
  const tx = await getProvider().getTransaction(input.txHash);
  if (!tx) throw new Error("Transaction details were not found on Arc");

  const iface = new Interface(RUGA_MARKET_ABI);
  const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
  const expectedFunction = input.side === "yes" ? "betYes" : "betNo";
  if (!parsed || parsed.name !== expectedFunction) {
    throw new Error(`Transaction did not call ${expectedFunction}`);
  }

  const txMarketId = Number(parsed.args.marketId ?? parsed.args[0]);
  const txAmount = BigInt(parsed.args.amount ?? parsed.args[1]);
  if (txMarketId !== input.marketId) {
    throw new Error("Transaction marketId does not match request body");
  }
  if (txAmount !== input.amount) {
    throw new Error("Transaction amount does not match request body");
  }

  return receipt;
}
