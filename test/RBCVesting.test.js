const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RBCVesting", function () {
    let rbcToken;
    let vesting;
    let owner;
    let beneficiary;
    let addr2;
    let vestingScheduleId;

    beforeEach(async function () {
        [owner, beneficiary, addr2] = await ethers.getSigners();
        
        const RBCToken = await ethers.getContractFactory("RBCToken");
        rbcToken = await RBCToken.deploy();
        
        const RBCVesting = await ethers.getContractFactory("RBCVesting");
        vesting = await RBCVesting.deploy(await rbcToken.getAddress());

        // Approve vesting contract to spend tokens
        const amount = ethers.parseUnits("1000", 18);
        await rbcToken.approve(await vesting.getAddress(), amount);
    });

    describe("Vesting Schedule Creation", function () {
        it("Should create a vesting schedule", async function () {
            const now = await time.latest();
            const amount = ethers.parseUnits("100", 18);
            const duration = 365 * 24 * 60 * 60; // 1 year
            const cliff = 180 * 24 * 60 * 60; // 6 months

            await vesting.createVestingSchedule(
                beneficiary.address,
                now,
                cliff,
                duration,
                amount,
                true
            );

            vestingScheduleId = await vesting.computeVestingScheduleId(beneficiary.address, 0);
            const schedule = await vesting.getVestingSchedule(vestingScheduleId);

            expect(schedule.beneficiary).to.equal(beneficiary.address);
            expect(schedule.totalAmount).to.equal(amount);
            expect(schedule.duration).to.equal(duration);
            expect(schedule.cliff).to.equal(cliff);
            expect(schedule.revocable).to.equal(true);
        });

        it("Should fail if not owner", async function () {
            const now = await time.latest();
            const amount = ethers.parseUnits("100", 18);

            await expect(
                vesting.connect(addr2).createVestingSchedule(
                    beneficiary.address,
                    now,
                    0,
                    365 * 24 * 60 * 60,
                    amount,
                    true
                )
            ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
        });
    });

    describe("Token Release", function () {
        beforeEach(async function () {
            const now = await time.latest();
            const amount = ethers.parseUnits("100", 18);
            const duration = 365 * 24 * 60 * 60; // 1 year
            const cliff = 180 * 24 * 60 * 60; // 6 months

            await vesting.createVestingSchedule(
                beneficiary.address,
                now,
                cliff,
                duration,
                amount,
                true
            );
            vestingScheduleId = await vesting.computeVestingScheduleId(beneficiary.address, 0);
        });

        it("Should not release tokens before cliff", async function () {
            await expect(
                vesting.release(vestingScheduleId)
            ).to.be.revertedWith("Cliff not reached");
        });

        it("Should release tokens after cliff", async function () {
            const schedule = await vesting.getVestingSchedule(vestingScheduleId);
            await time.increaseTo(schedule.start + schedule.cliff + 1);

            await vesting.release(vestingScheduleId);
            const balance = await rbcToken.balanceOf(beneficiary.address);
            expect(balance).to.be.gt(0);
        });
    });

    describe("Revocation", function () {
        beforeEach(async function () {
            const now = await time.latest();
            const amount = ethers.parseUnits("100", 18);
            await vesting.createVestingSchedule(
                beneficiary.address,
                now,
                0,
                365 * 24 * 60 * 60,
                amount,
                true
            );
            vestingScheduleId = await vesting.computeVestingScheduleId(beneficiary.address, 0);
        });

        it("Should revoke vesting", async function () {
            await vesting.revoke(vestingScheduleId);
            const schedule = await vesting.getVestingSchedule(vestingScheduleId);
            expect(schedule.revoked).to.be.true;
        });

        it("Should fail to revoke if not owner", async function () {
            await expect(
                vesting.connect(addr2).revoke(vestingScheduleId)
            ).to.be.revertedWithCustomError(vesting, "OwnableUnauthorizedAccount");
        });
    });
});