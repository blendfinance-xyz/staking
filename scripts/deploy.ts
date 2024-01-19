// @ts-ignore
import { ethers } from "hardhat";

async function main() {
  // deploy token
  const token = await ethers.deployContract("Token", ["Joey", "JOEY"]);
  await token.waitForDeployment();
  console.log("Token deployed to", token.target);
  // deploy staking
  const staking = await ethers.deployContract("Staking", [token.target]);
  await staking.waitForDeployment();
  console.log("Staking deployed to", staking.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error("deploy error", error);
  process.exitCode = 1;
});
