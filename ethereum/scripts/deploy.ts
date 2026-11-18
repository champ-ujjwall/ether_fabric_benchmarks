import { network } from "hardhat";

async function main() {
const { ethers } = await network.connect();

const contract = await ethers.deployContract("SolarTransaction");

console.log("Deploying SolarTransaction...");
await contract.waitForDeployment();

const address = await contract.getAddress();

console.log("SolarTransaction deployed successfully.");
console.log("Contract address:", address);
console.log("Total transactions:", (await contract.totalTransactions()).toString());
}

main().catch((error) => {
console.error(error);
process.exitCode = 1;
});
