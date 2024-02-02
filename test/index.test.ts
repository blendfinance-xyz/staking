import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { ContractFactory } from "ethers";
import { describe, test } from "mocha";
import assert, { strictEqual } from "node:assert";
import { Staking as StakingContract } from "../typechain-types/contracts/Staking";
import { Token as TokenContract } from "../typechain-types/contracts/Token";

// @ts-ignore
import { ethers } from "hardhat";

const REWARD_RATE_DECIMALS = 6;
// all time on chain is in second
const DAY_MULTIPLIER = 24n * 60n * 60n;
const YEAR = 365n * DAY_MULTIPLIER;

function n2b(n: number, decimals: number | bigint): bigint {
  const ns = n.toString();
  let [int, dec] = ns.split(".");
  if (int === "0") int = "";
  if (!dec) dec = "";
  if (dec.length <= Number(decimals)) {
    dec = dec.padEnd(Number(decimals), "0");
  } else {
    dec = dec.slice(0, Number(decimals));
  }
  return BigInt(`${int}${dec}`);
}

function b2n(b: bigint, decimals: number | bigint): number {
  const bs = b.toString();
  if (bs.length <= Number(decimals)) {
    return parseFloat(`0.${bs.padStart(Number(decimals), "0")}`);
  } else {
    return parseFloat(
      `${bs.slice(0, bs.length - Number(decimals))}.${bs.slice(
        bs.length - Number(decimals),
      )}`,
    );
  }
}

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
  1;
}

describe("deploy test", () => {
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

describe("business test", () => {
  test("should be set right reward rate", async () => {
    const { staking } = await loadFixture(deploy);
    const lockupDays = 30n;
    const rewardRate = 0.1;
    await staking.setRewardRate(lockupDays, n2b(rewardRate, 6));
    const rr = await staking.rewardRate(lockupDays);
    strictEqual(rr, n2b(rewardRate, 6), "reward rate is not right");
  });
  test("should be stake right", async () => {
    const { otherAccount, token, staking } = await loadFixture(deploy);
    // token
    const decimals = await token.decimals();
    // staking
    const lockupDays = 30n * DAY_MULTIPLIER;
    const rewardRate = 0.1;
    await staking.setRewardRate(lockupDays, n2b(rewardRate, 6));
    // do stake
    const stakingAmount = n2b(1, decimals);
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    // check
    strictEqual(
      await staking.totalStaked(),
      stakingAmount,
      "total staked is not right",
    );
    strictEqual(
      await staking.balanceOf(otherAccount.address),
      stakingAmount,
      "balance is not right",
    );
    strictEqual(
      await staking.balanceOfOne(otherAccount.address, lockupDays),
      stakingAmount,
      "balance one is not right",
    );
    strictEqual(
      await staking.leftLockupTime(otherAccount.address, lockupDays),
      lockupDays,
      "left time is not right",
    );
  });
  test("should be right reward", async () => {
    const { otherAccount, token, staking } = await loadFixture(deploy);
    // token
    const decimals = await token.decimals();
    // staking
    const lockupDays = 30n * DAY_MULTIPLIER;
    const rewardRate = 0.1;
    await staking.setRewardRate(lockupDays, n2b(rewardRate, 6));
    // do stake
    const stakingAmount = n2b(1, decimals);
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    // check
    const reward = await staking.getReward(otherAccount.address, lockupDays);
    const ra =
      (stakingAmount * n2b(rewardRate, 6) * lockupDays) / (n2b(1, 6) * YEAR);
    strictEqual(reward, ra, "reward is not right");
  });
  test("should be unstake right", async () => {
    const { otherAccount, initAmount, token, staking } =
      await loadFixture(deploy);
    // token
    const decimals = await token.decimals();
    // staking
    const lockupDays = 30n * DAY_MULTIPLIER;
    const rewardRate = 0.1;
    await staking.setRewardRate(lockupDays, n2b(rewardRate, 6));
    // do stake
    const stakingAmount = n2b(1, decimals);
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    const reward = await staking.getReward(otherAccount.address, lockupDays);
    await time.increase(lockupDays);
    // do unstake
    await staking.connect(otherAccount).unstake(lockupDays);
    // check
    strictEqual(
      await staking.totalStaked(),
      0n,
      "total staked is not right after unstake",
    );
    strictEqual(
      await staking.balanceOf(otherAccount.address),
      0n,
      "balance is not right after unstake",
    );
    strictEqual(
      await staking.balanceOfOne(otherAccount.address, lockupDays),
      0n,
      "balance one is not right after unstake",
    );
    strictEqual(
      await token.balanceOf(otherAccount.address),
      initAmount + reward,
      "token balance is not right after unstake",
    );
  });
  test("should not be unstaked before lockup time", async () => {
    const { otherAccount, token, staking } = await loadFixture(deploy);
    // token
    const decimals = await token.decimals();
    // staking
    const lockupDays = 30n * DAY_MULTIPLIER;
    const rewardRate = 0.1;
    await staking.setRewardRate(lockupDays, n2b(rewardRate, 6));
    // do stake
    const stakingAmount = n2b(1, decimals);
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
    const { otherAccount, token, staking, initAmount } =
      await loadFixture(deploy);
    // token
    const decimals = await token.decimals();
    // staking
    const lockupDays = 30n * DAY_MULTIPLIER;
    const rewardRate = 0.1;
    await staking.setRewardRate(lockupDays, n2b(rewardRate, 6));
    // do stake
    const stakingAmount = n2b(1, decimals);
    await token
      .connect(otherAccount)
      .approve(await staking.getAddress(), stakingAmount);
    await staking.connect(otherAccount).stake(lockupDays, stakingAmount);
    // do abort
    await staking.connect(otherAccount).abort(lockupDays);
    // check
    strictEqual(
      await staking.totalStaked(),
      0n,
      "total staked is not right after abort",
    );
    strictEqual(
      await staking.balanceOf(otherAccount.address),
      0n,
      "balance is not right after abort",
    );
    strictEqual(
      await staking.balanceOfOne(otherAccount.address, lockupDays),
      0n,
      "balance one is not right after abort",
    );
    strictEqual(
      await token.balanceOf(otherAccount.address),
      initAmount,
      "token balance is not right after abort",
    );
  });
});
