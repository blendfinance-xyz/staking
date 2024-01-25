// @ts-ignore
import { ethers } from "hardhat";

async function main() {
  // deploy staking
  const staking = await ethers.deployContract("Staking", [
    "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
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
