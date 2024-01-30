// @ts-ignore
import { ethers } from "hardhat";

async function main() {
  // deploy staking
  const staking = await ethers.deployContract("Staking", [
    "0xA37E268923652749Ba41DD0bBF6227C276047463",
  ]);
  await staking.waitForDeployment();
  console.log("Staking deployed to", staking.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error("deploy error", error);
  process.exitCode = 1;
});
