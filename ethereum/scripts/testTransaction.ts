import { network } from "hardhat";

async function main() {
const { ethers } = await network.connect();

// Deploy a fresh contract to the currently running local blockchain.
const contract = await ethers.deployContract("SolarTransaction");
await contract.waitForDeployment();

const contractAddress = await contract.getAddress();

console.log("SolarTransaction deployed at:", contractAddress);

// Sample bill dated 15 October 2026, midnight UTC.
const billDate = Math.floor(Date.UTC(2026, 9, 15, 0, 0, 0) / 1000);

const billId = 123456;
const consumerId = 657676;
const transactionId = 475478;

// Units use hundredths of kWh; money and rate use paise.
const unitsGenerated = 10000n;
const unitsConsumed = 45500n;
const amountPayablePaise = 45500n;
const electricityRatePaise = 700n;

console.log("\nStoring sample transaction...");

const tx = await contract.storeTransaction(
billDate,
billId,
consumerId,
transactionId,
unitsGenerated,
unitsConsumed,
amountPayablePaise,
electricityRatePaise
);

const receipt = await tx.wait();

if (!receipt) {
throw new Error("Transaction receipt was not returned.");
}

console.log("Transaction stored successfully.");
console.log("Transaction hash:", receipt.hash);
console.log("Block number:", receipt.blockNumber);
console.log("Gas used:", receipt.gasUsed.toString());

const stored = await contract.getTransaction(transactionId);

console.log("\nRetrieved transaction:");
console.log("Bill date (Unix timestamp):", stored.billDate.toString());
console.log("Bill ID:", stored.billId.toString());
console.log("Consumer ID:", stored.consumerId.toString());
console.log("Transaction ID:", stored.transactionId.toString());
console.log(
"Units generated (kWh):",
(Number(stored.unitsGenerated) / 100).toFixed(2)
);
console.log(
"Units consumed (kWh):",
(Number(stored.unitsConsumed) / 100).toFixed(2)
);
console.log(
"Amount payable (rupees):",
(Number(stored.amountPayablePaise) / 100).toFixed(2)
);
console.log(
"Electricity rate (rupees/kWh):",
(Number(stored.electricityRatePaise) / 100).toFixed(2)
);

// Calculate the expected hash from the original input values.
const expectedHash = await contract.calculateHash(
billDate,
billId,
consumerId,
transactionId,
unitsGenerated,
unitsConsumed,
amountPayablePaise,
electricityRatePaise
);

const verified = await contract.verifyTransaction(
transactionId,
expectedHash
);

console.log("\nExpected data hash:", expectedHash);
console.log("Stored data hash:", stored.dataHash);
console.log("Integrity verification:", verified);
console.log(
"Total transactions stored:",
(await contract.totalTransactions()).toString()
);
}

main().catch((error) => {
console.error("Test failed:", error);
process.exitCode = 1;
});
