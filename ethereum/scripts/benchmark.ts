import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  AbiCoder,
  keccak256,
  parseUnits,
} from "ethers";

type Bill = {
  billDate: string;
  billId: string;
  consumerId: string;
  transactionId: string;
  unitsGenerated: string;
  unitsConsumed: string;
  amountPayable: string;
  ratePerKWh: string;
};

function dateToTimestamp(value: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid date format: ${value}`);
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const timestamp = Date.UTC(year, month - 1, day) / 1000;
  const check = new Date(timestamp * 1000);

  if (
    check.getUTCDate() !== day ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCFullYear() !== year
  ) {
    throw new Error(`Invalid calendar date: ${value}`);
  }

  return timestamp;
}

function parseId(value: string, field: string): number {
  if (!/^\d{6}$/.test(value)) {
    throw new Error(`${field} must be a six-digit ID: ${value}`);
  }

  return Number(value);
}

function validateDecimal(value: string, field: string): void {
  if (!/^\d+\.\d{2}$/.test(value)) {
    throw new Error(
      `${field} must contain exactly two decimal places: ${value}`,
    );
  }
}

function calculateExpectedHash(bill: Bill): string {
  const coder = AbiCoder.defaultAbiCoder();

  const encoded = coder.encode(
    [
      "uint32",
      "uint32",
      "uint32",
      "uint32",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
    ],
    [
      dateToTimestamp(bill.billDate),
      parseId(bill.billId, "billId"),
      parseId(bill.consumerId, "consumerId"),
      parseId(bill.transactionId, "transactionId"),
      parseUnits(bill.unitsGenerated, 2),
      parseUnits(bill.unitsConsumed, 2),
      parseUnits(bill.amountPayable, 2),
      parseUnits(bill.ratePerKWh, 2),
    ],
  );

  // Calculate independently off-chain using Ethereum's Keccak-256.
  return keccak256(encoded);
}

function validateDataset(bills: Bill[]): void {
  if (!Array.isArray(bills) || bills.length === 0) {
    throw new Error("The dataset must be a non-empty JSON array.");
  }

  const transactionIds = new Set<string>();
  const billIds = new Set<string>();

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];

    if (!bill || typeof bill !== "object") {
      throw new Error(`Invalid record at index ${i}.`);
    }

    dateToTimestamp(bill.billDate);
    parseId(bill.billId, "billId");
    parseId(bill.consumerId, "consumerId");
    parseId(bill.transactionId, "transactionId");

    validateDecimal(bill.unitsGenerated, "unitsGenerated");
    validateDecimal(bill.unitsConsumed, "unitsConsumed");
    validateDecimal(bill.amountPayable, "amountPayable");
    validateDecimal(bill.ratePerKWh, "ratePerKWh");

    if (transactionIds.has(bill.transactionId)) {
      throw new Error(
        `Duplicate transaction ID: ${bill.transactionId}`,
      );
    }

    if (billIds.has(bill.billId)) {
      throw new Error(`Duplicate bill ID: ${bill.billId}`);
    }

    transactionIds.add(bill.transactionId);
    billIds.add(bill.billId);
  }
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const average = mean(values);

  const variance = mean(
    values.map((value) => (value - average) ** 2),
  );

  return Math.sqrt(variance);
}

async function main() {
  const datasetName =
    process.env.DATASET_NAME ?? "sampleBills_100.json";

  const datasetPath = path.resolve(
    "datasets",
    "data",
    datasetName,
  );

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Dataset not found: ${datasetPath}`);
  }

  const bills = JSON.parse(
    fs.readFileSync(datasetPath, "utf8"),
  ) as Bill[];

  console.log("======================================");
  console.log("SOLAR BLOCKCHAIN BENCHMARK");
  console.log("======================================");
  console.log("Dataset:", datasetName);
  console.log("Records loaded:", bills.length);
  console.log("\nValidating dataset...");

  validateDataset(bills);

  console.log("Dataset validation passed.");

  const { ethers } = await network.connect();

  console.log("\nDeploying a fresh contract...");

  const contract = await ethers.deployContract("SolarTransaction");

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log("Contract address:", contractAddress);
  console.log("\nStarting write benchmark...");

  const writeLatencies: number[] = [];
  const gasValues: bigint[] = [];

  const writeStart = performance.now();

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];

    const billDate = dateToTimestamp(bill.billDate);
    const billId = parseId(bill.billId, "billId");
    const consumerId = parseId(bill.consumerId, "consumerId");
    const transactionId = parseId(
      bill.transactionId,
      "transactionId",
    );

    const unitsGenerated = parseUnits(bill.unitsGenerated, 2);
    const unitsConsumed = parseUnits(bill.unitsConsumed, 2);
    const amountPayablePaise = parseUnits(bill.amountPayable, 2);
    const electricityRatePaise = parseUnits(bill.ratePerKWh, 2);

    const start = performance.now();

    const tx = await contract.storeTransaction(
      billDate,
      billId,
      consumerId,
      transactionId,
      unitsGenerated,
      unitsConsumed,
      amountPayablePaise,
      electricityRatePaise,
    );

    const receipt = await tx.wait();

    const end = performance.now();

    if (!receipt || receipt.status !== 1) {
      throw new Error(
        `Storage failed for transaction ${bill.transactionId}`,
      );
    }

    writeLatencies.push(end - start);
    gasValues.push(receipt.gasUsed);

    if ((i + 1) % 10 === 0 || i + 1 === bills.length) {
      console.log(`Stored ${i + 1}/${bills.length} records`);
    }
  }

  const totalWriteTimeMs = performance.now() - writeStart;

  console.log("\nAll records stored successfully.");
  console.log("\nStarting retrieval and integrity verification...");

  const retrievalLatencies: number[] = [];
  const verificationLatencies: number[] = [];

  let recordsRetrieved = 0;
  let recordsVerified = 0;

  const retrievalStart = performance.now();

  for (let i = 0; i < bills.length; i++) {
    const bill = bills[i];

    const transactionId = parseId(
      bill.transactionId,
      "transactionId",
    );

    // Measure retrieval separately.
    const retrieveStart = performance.now();

    const stored = await contract.getTransaction(transactionId);

    const retrieveEnd = performance.now();

    retrievalLatencies.push(retrieveEnd - retrieveStart);
    recordsRetrieved++;

    // Independently calculate the expected hash from the JSON record.
    const expectedHash = calculateExpectedHash(bill);
    const storedHash = stored.dataHash as string;

    if (storedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new Error(
        `Off-chain hash mismatch for transaction ${bill.transactionId}`,
      );
    }

    // Measure the contract's verification call separately.
    const verifyStart = performance.now();

    const verified = await contract.verifyTransaction(
      transactionId,
      expectedHash,
    );

    const verifyEnd = performance.now();

    verificationLatencies.push(verifyEnd - verifyStart);

    if (!verified) {
      throw new Error(
        `Contract verification failed for ${bill.transactionId}`,
      );
    }

    recordsVerified++;

    if ((i + 1) % 10 === 0 || i + 1 === bills.length) {
      console.log(`Verified ${i + 1}/${bills.length} records`);
    }
  }

  const totalRetrievalAndVerificationTimeMs =
    performance.now() - retrievalStart;

  const totalRetrievalTimeMs = retrievalLatencies.reduce(
    (sum, value) => sum + value,
    0,
  );

  const totalVerificationTimeMs = verificationLatencies.reduce(
    (sum, value) => sum + value,
    0,
  );

  const totalGasUsed = gasValues.reduce(
    (sum, value) => sum + value,
    0n,
  );

  const result = {
    dataset: datasetName,
    network: "Local Hardhat Network",
    contractAddress,

    recordsRequested: bills.length,
    recordsStored: bills.length,
    recordsRetrieved,
    recordsVerified,

    totalWriteTimeMs: Number(totalWriteTimeMs.toFixed(3)),
    averageWriteLatencyMs: Number(mean(writeLatencies).toFixed(3)),
    p50WriteLatencyMs: Number(percentile(writeLatencies, 50).toFixed(3)),
    p95WriteLatencyMs: Number(percentile(writeLatencies, 95).toFixed(3)),
    p99WriteLatencyMs: Number(percentile(writeLatencies, 99).toFixed(3)),

    writeLatencyStdDevMs: Number(
      standardDeviation(writeLatencies).toFixed(3),
    ),

    totalGasUsed: totalGasUsed.toString(),

    averageGasPerRecord: Number(
      (Number(totalGasUsed) / gasValues.length).toFixed(2),
    ),

    totalRetrievalTimeMs: Number(totalRetrievalTimeMs.toFixed(3)),

    averageRetrievalLatencyMs: Number(
      mean(retrievalLatencies).toFixed(3),
    ),

    totalVerificationTimeMs: Number(
      totalVerificationTimeMs.toFixed(3),
    ),

    averageVerificationLatencyMs: Number(
      mean(verificationLatencies).toFixed(3),
    ),

    totalRetrievalAndVerificationTimeMs: Number(
      totalRetrievalAndVerificationTimeMs.toFixed(3),
    ),

    throughputRecordsPerSecond: Number(
      (bills.length / (totalWriteTimeMs / 1000)).toFixed(3),
    ),

    successRatePercent: Number(
      ((recordsVerified / bills.length) * 100).toFixed(2),
    ),

    benchmarkNotes: [
      "Transactions are submitted sequentially.",
      "Write latency measures submission through receipt retrieval.",
      "Retrieval and verification are measured separately.",
      "Expected hashes are independently calculated off-chain.",
      "This is a local Hardhat benchmark, not an Ethereum mainnet benchmark.",
    ],
  };

  const resultsDirectory = path.resolve("results");

  fs.mkdirSync(resultsDirectory, { recursive: true });

  const outputPath = path.join(
    resultsDirectory,
    `ethereum_${path.parse(datasetName).name}_results.json`,
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(result, null, 2),
    "utf8",
  );

  console.log("\n======================================");
  console.log("BENCHMARK RESULTS");
  console.log("======================================");

  console.table({
    "Records requested": result.recordsRequested,
    "Records stored": result.recordsStored,
    "Records retrieved": result.recordsRetrieved,
    "Records verified": result.recordsVerified,
    "Total write time (ms)": result.totalWriteTimeMs,
    "Average write latency (ms)": result.averageWriteLatencyMs,
    "P50 write latency (ms)": result.p50WriteLatencyMs,
    "P95 write latency (ms)": result.p95WriteLatencyMs,
    "P99 write latency (ms)": result.p99WriteLatencyMs,
    "Write latency std. deviation (ms)": result.writeLatencyStdDevMs,
    "Total gas used": result.totalGasUsed,
    "Average gas per record": result.averageGasPerRecord,
    "Average retrieval latency (ms)": result.averageRetrievalLatencyMs,
    "Average verification latency (ms)": result.averageVerificationLatencyMs,
    "Throughput (records/second)": result.throughputRecordsPerSecond,
    "Success rate (%)": result.successRatePercent,
  });

  console.log("\nResults saved to:");
  console.log(outputPath);

  console.log(
    "\nAll records were retrieved and passed integrity verification.",
  );
}

main().catch((error) => {
  console.error("\nBenchmark failed:");
  console.error(error);
  process.exitCode = 1;
});
