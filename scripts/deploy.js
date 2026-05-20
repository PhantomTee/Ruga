const { ethers } = require("hardhat");

async function main() {
  const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS;
  if (!usdc) {
    throw new Error("NEXT_PUBLIC_USDC_ADDRESS is required");
  }

  const RugaMarket = await ethers.getContractFactory("RugaMarket");
  const market = await RugaMarket.deploy(usdc);
  await market.waitForDeployment();

  process.stdout.write(`RugaMarket deployed to ${await market.getAddress()}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
