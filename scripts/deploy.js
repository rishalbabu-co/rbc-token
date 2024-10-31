const hre = require("hardhat");

async function main() {
    console.log("Deploying RBC Token...");

    // Deploy Token
    const RBCToken = await hre.ethers.getContractFactory("RBCToken");
    const token = await RBCToken.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log(`RBC Token deployed to: ${tokenAddress}`);

    // Deploy Vesting
    console.log("Deploying Vesting Contract...");
    const RBCVesting = await hre.ethers.getContractFactory("RBCVesting");
    const vesting = await RBCVesting.deploy(tokenAddress);
    await vesting.waitForDeployment();
    const vestingAddress = await vesting.getAddress();
    console.log(`Vesting Contract deployed to: ${vestingAddress}`);

    // Wait for block confirmations
    await token.deploymentTransaction().wait(5);
    await vesting.deploymentTransaction().wait(5);

    console.log("Deployment completed!");

    // Verify contracts if not on local network
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("Verifying contracts...");
        await hre.run("verify:verify", {
            address: tokenAddress,
            constructorArguments: [],
        });
        await hre.run("verify:verify", {
            address: vestingAddress,
            constructorArguments: [tokenAddress],
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });