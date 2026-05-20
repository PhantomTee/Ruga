export const RUGA_MARKET_ABI = [
  "event MarketCreated(uint256 indexed id,string tokenSymbol,string coingeckoId,uint256 priceAtCreation,uint256 resolvesAt)",
  "function marketCount() view returns (uint256)",
  "function accruedPlatformFees() view returns (uint256)",
  "function createMarket(string tokenSymbol,string tokenName,string coingeckoId,uint256 currentPrice) returns (uint256)",
  "function betYes(uint256 marketId,uint256 amount)",
  "function betNo(uint256 marketId,uint256 amount)",
  "function resolveMarket(uint256 marketId,bool rugged)",
  "function claimWinnings(uint256 marketId)",
  "function withdrawPlatformFees(address recipient,uint256 amount)",
  "function getMarket(uint256 marketId) view returns (uint256 id,string tokenSymbol,string tokenName,string coingeckoId,uint256 createdAt,uint256 resolvesAt,uint256 yesPool,uint256 noPool,bool resolved,bool outcome,uint256 priceAtCreation)",
  "function getUserBets(uint256 marketId,address user) view returns (uint256 yes,uint256 no)"
] as const;

export const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
] as const;
