require("@nomicfoundation/hardhat-ethers");

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    arcTestnet: {
      url: process.env.NEXT_PUBLIC_ARC_RPC || "",
      chainId: Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID),
      accounts: process.env.AGENT_PRIVATE_KEY ? [process.env.AGENT_PRIVATE_KEY] : []
    }
  }
};
