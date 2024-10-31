// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RBCVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint256 cliff;
        uint256 start;
        uint256 duration;
        uint256 totalAmount;
        uint256 releasedAmount;
        bool revocable;
        bool revoked;
    }

    IERC20 public immutable token;
    mapping(bytes32 => VestingSchedule) public vestingSchedules;
    uint256 public vestingSchedulesCount;
    mapping(address => uint256) public holdersVestingCount;

    event VestingScheduleCreated(bytes32 indexed vestingScheduleId, address beneficiary);
    event TokensReleased(bytes32 indexed vestingScheduleId, uint256 amount);
    event VestingScheduleRevoked(bytes32 indexed vestingScheduleId);

    constructor(address tokenAddress) Ownable(msg.sender) {
        require(tokenAddress != address(0), "Token address cannot be zero");
        token = IERC20(tokenAddress);
    }

    function createVestingSchedule(
        address beneficiary,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 totalAmount,
        bool revocable
    ) external onlyOwner {
        require(beneficiary != address(0), "Beneficiary cannot be zero address");
        require(duration > 0, "Duration must be > 0");
        require(totalAmount > 0, "Amount must be > 0");
        require(cliff <= duration, "Cliff must be <= duration");

        bytes32 vestingScheduleId = computeVestingScheduleId(beneficiary, vestingSchedulesCount);
        vestingSchedulesCount++;
        holdersVestingCount[beneficiary]++;

        vestingSchedules[vestingScheduleId] = VestingSchedule({
            initialized: true,
            beneficiary: beneficiary,
            cliff: cliff,
            start: start,
            duration: duration,
            totalAmount: totalAmount,
            releasedAmount: 0,
            revocable: revocable,
            revoked: false
        });

        token.safeTransferFrom(msg.sender, address(this), totalAmount);
        emit VestingScheduleCreated(vestingScheduleId, beneficiary);
    }

    function release(bytes32 vestingScheduleId) public nonReentrant {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        require(vestingSchedule.initialized, "Invalid vesting schedule");
        require(!vestingSchedule.revoked, "Vesting schedule revoked");
        require(block.timestamp >= vestingSchedule.start + vestingSchedule.cliff, "Cliff not reached");

        uint256 releasable = computeReleasableAmount(vestingSchedule);
        require(releasable > 0, "No tokens to release");

        vestingSchedule.releasedAmount += releasable;
        token.safeTransfer(vestingSchedule.beneficiary, releasable);
        emit TokensReleased(vestingScheduleId, releasable);
    }

    function revoke(bytes32 vestingScheduleId) external onlyOwner {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        require(vestingSchedule.initialized, "Invalid vesting schedule");
        require(vestingSchedule.revocable, "Vesting schedule not revocable");
        require(!vestingSchedule.revoked, "Vesting schedule already revoked");

        uint256 releasable = computeReleasableAmount(vestingSchedule);
        if (releasable > 0) {
            release(vestingScheduleId);
        }

        uint256 unreleased = vestingSchedule.totalAmount - vestingSchedule.releasedAmount;
        vestingSchedule.revoked = true;
        token.safeTransfer(owner(), unreleased);
        emit VestingScheduleRevoked(vestingScheduleId);
    }

    function computeReleasableAmount(VestingSchedule memory vestingSchedule) 
        internal 
        view 
        returns (uint256) 
    {
        if (block.timestamp < vestingSchedule.start + vestingSchedule.cliff) {
            return 0;
        }
        if (block.timestamp >= vestingSchedule.start + vestingSchedule.duration) {
            return vestingSchedule.totalAmount - vestingSchedule.releasedAmount;
        }
        uint256 timeFromStart = block.timestamp - vestingSchedule.start;
        uint256 vestedAmount = (vestingSchedule.totalAmount * timeFromStart) / vestingSchedule.duration;
        return vestedAmount - vestingSchedule.releasedAmount;
    }

    function computeVestingScheduleId(address holder, uint256 index) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    function getVestingSchedule(bytes32 vestingScheduleId) 
        external 
        view 
        returns (VestingSchedule memory) 
    {
        return vestingSchedules[vestingScheduleId];
    }
}