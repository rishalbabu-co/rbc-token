const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RBC Governance", function () {
    let token;
    let governor;
    let timelock;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        
        // Deploy token
        const RBCToken = await ethers.getContractFactory("RBCToken");
        token = await RBCToken.deploy();

        // Deploy timelock
        const TimelockController = await ethers.getContractFactory("TimelockController");
        timelock = await TimelockController.deploy(
            1, // Minimum delay
            [owner.address], // Proposers
            [owner.address], // Executors
            owner.address // Admin
        );

        // Deploy governor
        const RBCGovernor = await ethers.getContractFactory("RBCGovernor");
        governor = await RBCGovernor.deploy(
            await token.getAddress(),
            await timelock.getAddress()
        );

        // Setup roles
        await timelock.grantRole(await timelock.PROPOSER_ROLE(), await governor.getAddress());
        await timelock.grantRole(await timelock.EXECUTOR_ROLE(), await governor.getAddress());
        await timelock.revokeRole(await timelock.TIMELOCK_ADMIN_ROLE(), owner.address);
    });

    describe("Token Snapshots", function () {
        it("Should create snapshot and maintain historical balances", async function () {
            const amount = ethers.parseUnits("1000", 18);
            await token.transfer(addr1.address, amount);
            
            await token.snapshot();
            await token.connect(addr1).transfer(addr2.address, amount / 2n);
            
            const snapshotId = await token.getCurrentSnapshotId();
            expect(await token.balanceOfAt(addr1.address, snapshotId)).to.equal(amount);
        });
    });

    describe("Governance", function () {
        it("Should create and execute proposal", async function () {
            const amount = ethers.parseUnits("100", 18);
            await token.delegate(owner.address);

            const transferCalldata = token.interface.encodeFunctionData("transfer", [addr1.address, amount]);
            const proposalDescription = "Proposal #1: Transfer tokens to addr1";

            const tx = await governor.propose(
                [await token.getAddress()],
                [0],
                [transferCalldata],
                proposalDescription
            );
            const receipt = await tx.wait();
            const proposalId = receipt.logs[0].args[0];

            await time.increase(2 * 24 * 60 * 60); // Move past voting delay

            await governor.castVote(proposalId, 1); // Vote in favor

            await time.increase(8 * 24 * 60 * 60); // Move past voting period

            const descriptionHash = ethers.id(proposalDescription);
            await governor.queue(
                [await token.getAddress()],
                [0],
                [transferCalldata],
                descriptionHash
            );

            await time.increase(2); // Move past timelock

            await governor.execute(
                [await token.getAddress()],
                [0],
                [transferCalldata],
                descriptionHash
            );

            expect(await token.balanceOf(addr1.address)).to.equal(amount);
        });
    });
});