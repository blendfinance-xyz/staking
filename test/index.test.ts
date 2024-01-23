import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { ContractFactory } from "ethers";
import { describe, test } from "mocha";
import assert, { strictEqual } from "node:assert";
import { Staking as StakingContract } from "../typechain-types/contracts/Staking";
import { Token as TokenContract } from "../typechain-types/contracts/Token";

// @ts-ignore
import { ethers } from "hardhat";

const REWARD_RATE_DIVIDER = 10 ** 6;
// all time on chain is in second
const DAY_MULTIPLIER = 24 * 60 * 60;
const YEAR = 365 * DAY_MULTIPLIER;

async function deploy() {
  const [owner, otherAccount] = await ethers.getSigners();
  // token
  const Token: ContractFactory = await ethers.getContractFactory("Token");
  const token = (await Token.deploy("Token", "TKN")) as TokenContract;
  const initAmount = 100n * 10n ** 18n;
  await token.mint(owner.address, initAmount);
  await token.mint(otherAccount.address, initAmount);
  // staking
  const Staking: ContractFactory = await ethers.getContractFactory("Staking");
  const staking = (await Staking.deploy(token.getAddress())) as StakingContract;
  const initRewardAmount = 100n * 10n ** 18n;
  await token.mint(staking.getAddress(), initRewardAmount);
  return {
    owner,
    otherAccount,
    initAmount,
    token,
    staking,
    initRewardAmount,
  };
}

describe("deploy test", () => {
  test("should be mint right amount", async () => {
    const {
      owner,
      otherAccount,
      initAmount,
      token,
      staking,
      initRewardAmount,
    } = await loadFixture(deploy);
    const ownerTokenBalance = await token.balanceOf(owner.address);
    const otherTokenBalance = await token.balanceOf(otherAccount.address);
    strictEqual(ownerTokenBalance.toString(), initAmount.toString());
    strictEqual(otherTokenBalance.toString(), initAmount.toString());
    const stakingTokenBalance = await token.balanceOf(staking.getAddress());
    strictEqual(stakingTokenBalance.toString(), initRewardAmount.toString());
  });
  test("should be right owner", async () => {
    const { owner, staking } = await loadFixture(deploy);
    strictEqual(
      await staking.owner(),
      owner.address,
      "staking owner is not right",
    );
  });
  test("should be right token", async () => {
    const { token, staking } = await loadFixture(deploy);
    strictEqual(
      await staking.token(),
      await token.getAddress(),
      "staking token is not right",
    );
  });
});

describe("token test", () => {
  test("should claim right", async () => {
    const { otherAccount, token } = await loadFixture(deploy);
    const claimAmount = await token.claimAmount();
    const otherTokenBalance = await token.balanceOf(otherAccount.address);
    await token.connect(otherAccount).claim();
    const otherTokenBalanceAfterClaim = await token.balanceOf(
      otherAccount.address,
    );
    strictEqual(
      otherTokenBalanceAfterClaim.toString(),
      (otherTokenBalance + claimAmount).toString(),
      "token balance is not right after claim",
    );
  });
  test("should not claim before claim time", async () => {
    const { otherAccount, token } = await loadFixture(deploy);
    await token.connect(otherAccount).claim();
    try {
      await token.connect(otherAccount).claim();
      assert(false, "claim before claim time");
    } catch (e) {}
  });
  test("should claim after claim time", async () => {
    const { otherAccount, token } = await loadFixture(deploy);
    await token.connect(otherAccount).claim();
    await time.increase(1 * DAY_MULTIPLIER);
    try {
      await token.connect(otherAccount).claim();
    } catch (e) {
      assert(false, "can not claim after claim time");
    }
  });
});

describe("business test", () => {
  test("should be set right registrar", async () => {
    const { staking } = await loadFixture(deploy);
    const lockupDays = 30n;
    const rewardRate = 0.1;
    await staking.setRegistrar(
      lockupDays,
      BigInt(rewardRate * REWARD_RATE_DIVIDER),
    );
    const rr = await staking.rewardRate(lockupDays);
    strictEqual(
      rr.toString(),
      BigInt(rewardRate * REWARD_RATE_DIVIDER).toString(),
      "reward rate is not right",
    );
  });
  test("should be stake right", async () => {
    const { otherAccount, token, staking } = await loadFixture(deploy);
    // token
    const tokenMultiplier = 10n ** (await token.decimals());
    // staking
    const lockupDays = 30n * BigInt(DAY_MULTIPLIER);
    const rewardRate = BigInt(0.1 * REWARD_RATE_DIVIDER);
    await staking.setRegistrar(lockupDays, rewardRate);
    // do stake
    const stakingAmount = 1n * tokenMultiplier;
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    // check
    const balance = await staking.balanceOf(otherAccount.address, lockupDays);
    strictEqual(
      balance.toString(),
      stakingAmount.toString(),
      "balance is not right",
    );
    const leftTime = await staking.leftLockupTime(
      otherAccount.address,
      lockupDays,
    );
    assert(leftTime > 0, "left time is not right");
  });
  test("should be right reward", async () => {
    const { otherAccount, token, staking } = await loadFixture(deploy);
    // token
    const tokenMultiplier = 10n ** (await token.decimals());
    // staking
    const lockupDays = 30n * BigInt(DAY_MULTIPLIER);
    const rewardRate = BigInt(0.1 * REWARD_RATE_DIVIDER);
    await staking.setRegistrar(lockupDays, rewardRate);
    // do stake
    const stakingAmount = 1n * tokenMultiplier;
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    // check
    const reward = await staking.getReward(otherAccount.address, lockupDays);
    const ra =
      (stakingAmount * rewardRate * lockupDays) /
      BigInt(REWARD_RATE_DIVIDER * YEAR);
    strictEqual(reward, ra, "reward is not right");
  });
  test("should be unstake right", async () => {
    const { otherAccount, initAmount, token, staking } =
      await loadFixture(deploy);
    // token
    const tokenMultiplier = 10n ** (await token.decimals());
    // staking
    const lockupDays = 30n * BigInt(DAY_MULTIPLIER);
    const rewardRate = BigInt(0.1 * REWARD_RATE_DIVIDER);
    await staking.setRegistrar(lockupDays, rewardRate);
    // do stake
    const stakingAmount = 1n * tokenMultiplier;
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    const reward = await staking.getReward(otherAccount.address, lockupDays);
    await time.increase(lockupDays);
    // do unstake
    await staking.connect(otherAccount).unstake(lockupDays);
    // check
    const balance = await staking.balanceOf(otherAccount.address, lockupDays);
    strictEqual(balance.toString(), "0", "balance is not right after unstake");
    const tokenBalance = await token.balanceOf(otherAccount.address);
    strictEqual(
      tokenBalance.toString(),
      (initAmount + reward).toString(),
      "token balance is not right after unstake",
    );
  });
  test("should not be unstaked before lockup time", async () => {
    const { otherAccount, token, staking } = await loadFixture(deploy);
    // token
    const tokenMultiplier = 10n ** (await token.decimals());
    // staking
    const lockupDays = 30n * BigInt(DAY_MULTIPLIER);
    const rewardRate = BigInt(0.1 * REWARD_RATE_DIVIDER);
    await staking.setRegistrar(lockupDays, rewardRate);
    // do stake
    const stakingAmount = 1n * tokenMultiplier;
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    try {
      await staking.connect(otherAccount).unstake(lockupDays);
      assert(false, "unstake before lockup time");
    } catch (e) {}
  });
  test("should be abort right", async () => {
    const { otherAccount, token, staking } = await loadFixture(deploy);
    // token
    const tokenMultiplier = 10n ** (await token.decimals());
    // staking
    const lockupDays = 30n * BigInt(DAY_MULTIPLIER);
    const rewardRate = BigInt(0.1 * REWARD_RATE_DIVIDER);
    await staking.setRegistrar(lockupDays, rewardRate);
    // do stake
    const stakingAmount = 1n * tokenMultiplier;
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    // do abort
    await staking.connect(otherAccount).abort(lockupDays);
    // check
    const balance = await staking.balanceOf(otherAccount.address, lockupDays);
    strictEqual(balance.toString(), "0", "balance is not right after abort");
  });
});
