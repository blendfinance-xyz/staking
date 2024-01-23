// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IBlast } from "../interfaces/IBlast.sol";

contract Staking is Ownable {
  struct Member {
    uint256 stakeTimestamp;
    uint256 balance;
  }

  mapping(uint256 => uint256) private _rewardRates;
  mapping(address => mapping(uint256 => Member)) private _members;

  address private _token;
  uint256 REWARD_RATE_DIVIDER = 10 ** 6;
  uint256 YEAR = 365 days;

  constructor(address token_) Ownable(msg.sender) {
    _token = token_;
    // remark this line before test, because blast is not available on local
    // IBlast(0x4300000000000000000000000000000000000002).configureClaimableGas();
  }

  event Stake(address indexed account, uint256 lockupTime, uint256 amount);

  event Unstaking(
    address indexed account,
    uint256 lockupTime,
    uint256 amount,
    uint256 reward
  );

  event Abort(address indexed account, uint256 lockupTime, uint256 amount);

  /**
   * @dev Gets the token address.
   */
  function token() public view returns (address) {
    return _token;
  }

  /**
   * @dev Gets the reward rate for a given lockup time.
   */
  function rewardRate(uint256 lockupTime_) public view returns (uint256) {
    return _rewardRates[lockupTime_];
  }

  /**
   * @dev Sets the reward rate for a given lockup time.
   */
  function setRegistrar(
    uint256 lockupTime_,
    uint256 rewardRate_
  ) external onlyOwner {
    require(lockupTime_ > 0, "Staking: lock time must be greater than 0");
    _rewardRates[lockupTime_] = rewardRate_;
  }

  function _findMember(
    address account_,
    uint256 lockupTime_
  ) internal view returns (Member storage) {
    return _members[account_][lockupTime_];
  }

  /**
   * @dev Gets the staked balance for a given lockup time and account.
   */
  function balanceOf(
    address account_,
    uint256 lockupTime_
  ) public view returns (uint256) {
    Member memory member = _findMember(account_, lockupTime_);
    return member.balance;
  }

  function leftLockupTime(
    address account_,
    uint256 lockupTime_
  ) public view returns (uint256) {
    Member memory member = _findMember(account_, lockupTime_);
    uint256 timeElapsed = block.timestamp - member.stakeTimestamp;
    return _safeSub(lockupTime_, timeElapsed);
  }

  /**
   * @dev Stakes a given amount for a given lockup time.
   */
  function stake(uint256 lockupTime_, uint256 amount_) external {
    require(amount_ > 0, "Staking: amount must be greater than 0");
    IERC20 tc = IERC20(_token);
    require(
      tc.balanceOf(msg.sender) >= amount_,
      "Staking: insufficient balance"
    );
    require(
      tc.allowance(msg.sender, address(this)) >= amount_,
      "Staking: insufficient allowance"
    );

    Member storage member = _findMember(msg.sender, lockupTime_);
    require(
      member.balance == 0,
      "Staking: account already has a stake for this lockup time"
    );

    tc.transferFrom(msg.sender, address(this), amount_);

    member.stakeTimestamp = block.timestamp;
    member.balance = amount_;

    _members[msg.sender][lockupTime_] = member;

    emit Stake(msg.sender, lockupTime_, amount_);
  }

  function _calculateReward(
    uint256 amount,
    uint256 rewardRate_,
    uint256 timeElapsed
  ) internal view returns (uint256) {
    return
      Math.mulDiv(
        amount,
        _safeMul(rewardRate_, timeElapsed),
        _safeMul(YEAR, REWARD_RATE_DIVIDER)
      );
  }

  /**
   * @dev Unstakes all amount and reward from a given lockup time.
   */
  function unstake(uint256 lockupTime_) external {
    require(rewardRate(lockupTime_) > 0, "Staking: reward rate must be greater than 0");
    Member storage member = _findMember(msg.sender, lockupTime_);
    require(
      member.balance > 0,
      "Staking: account does not have a stake for this lockup time"
    );
    require(
      block.timestamp - member.stakeTimestamp >= lockupTime_,
      "Staking: lockup time has not been reached"
    );
    uint256 reward = _calculateReward(member.balance, rewardRate(lockupTime_), lockupTime_);

    IERC20(_token).transfer(msg.sender, _safeAdd(member.balance, reward));

    delete _members[msg.sender][lockupTime_];

    emit Unstaking(msg.sender, lockupTime_, member.balance, reward);
  }

  /**
   * @dev Gets the reward value for a given lockup time and account.
   */
  function getReward(
    address account,
    uint256 lockupTime_
  ) public view returns (uint256) {
    require(rewardRate(lockupTime_) > 0, "Staking: reward rate must be greater than 0");
    Member memory member = _findMember(account, lockupTime_);
    require(
      member.balance > 0,
      "Staking: account does not have a stake for this lockup time"
    );
    return _calculateReward(member.balance, rewardRate(lockupTime_), lockupTime_);
  }

  /**
   * @dev Aborts a stake and returns the amount to the account.
   */
  function abort(uint256 lockupTime_) external {
    Member storage member = _findMember(msg.sender, lockupTime_);
    require(
      member.balance > 0,
      "Staking: account does not have a stake for this lockup time"
    );
    IERC20(_token).transfer(msg.sender, member.balance);
    delete _members[msg.sender][lockupTime_];
    emit Abort(msg.sender, lockupTime_, member.balance);
  }

  function claimAllGas() external onlyOwner {
    IBlast(0x4300000000000000000000000000000000000002).claimAllGas(
      address(this),
      msg.sender
    );
  }

  function _safeAdd(uint256 a, uint256 b) internal pure returns (uint256) {
    bool isMathSafe = false;
    uint256 c = 0;
    (isMathSafe, c) = Math.tryAdd(a, b);
    require(isMathSafe, "Staking: math error");
    return c;
  }

  function _safeSub(uint256 a, uint256 b) internal pure returns (uint256) {
    bool isMathSafe = false;
    uint256 c = 0;
    (isMathSafe, c) = Math.trySub(a, b);
    require(isMathSafe, "Staking: math error");
    return c;
  }

  function _safeMul(uint256 a, uint256 b) internal pure returns (uint256) {
    bool isMathSafe = false;
    uint256 c = 0;
    (isMathSafe, c) = Math.tryMul(a, b);
    require(isMathSafe, "Staking: math error");
    return c;
  }

  function _safeDiv(uint256 a, uint256 b) internal pure returns (uint256) {
    bool isMathSafe = false;
    uint256 c = 0;
    (isMathSafe, c) = Math.tryDiv(a, b);
    require(isMathSafe, "Staking: math error");
    return c;
  }
}
