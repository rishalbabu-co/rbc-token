const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RBCToken", function () {
  let rbcToken;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const RBCToken = await ethers.getContractFactory("RBCToken");
    rbcToken = await RBCToken.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await rbcToken.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await rbcToken.balanceOf(owner.address);
      expect(await rbcToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Should have correct initial supply", async function () {
      const expectedSupply = ethers.parseUnits("34000000", 18);
      expect(await rbcToken.totalSupply()).to.equal(expectedSupply);
    });

    it("Should have correct max cap", async function () {
      const expectedCap = ethers.parseUnits("34343434", 18);
      expect(await rbcToken.cap()).to.equal(expectedCap);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      const amount = ethers.parseUnits("50", 18);
      await rbcToken.transfer(addr1.address, amount);
      expect(await rbcToken.balanceOf(addr1.address)).to.equal(amount);

      await rbcToken.connect(addr1).transfer(addr2.address, amount);
      expect(await rbcToken.balanceOf(addr2.address)).to.equal(amount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await rbcToken.balanceOf(owner.address);
      await expect(
        rbcToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      expect(await rbcToken.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens up to cap", async function () {
      const mintAmount = ethers.parseUnits("100", 18);
      await rbcToken.mint(addr1.address, mintAmount);
      expect(await rbcToken.balanceOf(addr1.address)).to.equal(mintAmount);
    });

    it("Should fail if non-owner tries to mint", async function () {
      const mintAmount = ethers.parseUnits("100", 18);
      await expect(
        rbcToken.connect(addr1).mint(addr1.address, mintAmount)
      ).to.be.revertedWithCustomError(rbcToken, "OwnableUnauthorizedAccount");
    });

    it("Should fail if minting would exceed cap", async function () {
      const currentSupply = await rbcToken.totalSupply();
      const cap = await rbcToken.cap();
      const mintAmount = cap - currentSupply + 1n;
      
      await expect(
        rbcToken.mint(addr1.address, mintAmount)
      ).to.be.revertedWith("ERC20Capped: cap exceeded");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their tokens", async function () {
      const burnAmount = ethers.parseUnits("100", 18);
      await rbcToken.transfer(addr1.address, burnAmount);
      await rbcToken.connect(addr1).burn(burnAmount);
      expect(await rbcToken.balanceOf(addr1.address)).to.equal(0);
    });
  });

  describe("Pausable", function () {
    it("Should allow owner to pause and unpause transfers", async function () {
      await rbcToken.pause();
      const amount = ethers.parseUnits("50", 18);
      await expect(
        rbcToken.transfer(addr1.address, amount)
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");

      await rbcToken.unpause();
      await rbcToken.transfer(addr1.address, amount);
      expect(await rbcToken.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        rbcToken.connect(addr1).pause()
      ).to.be.revertedWithCustomError(rbcToken, "OwnableUnauthorizedAccount");
    });
  });
});