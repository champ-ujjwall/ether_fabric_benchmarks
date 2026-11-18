# ether\_fabric\_benchmarks



\# Ethereum vs Hyperledger Fabric: Solar Billing Blockchain Benchmark



\## Overview

This repository contains implementations and benchmarking resources for evaluating Ethereum and Hyperledger Fabric for solar electricity billing transactions.



The project evaluates blockchain-based storage, retrieval, and integrity verification of synthetic solar billing records.



\## Research Objectives

\- Evaluate transaction storage performance.

\- Measure retrieval and integrity verification performance.

\- Compare Ethereum and Hyperledger Fabric.

\- Evaluate performance across different dataset sizes.



\## Dataset

Synthetic solar billing datasets are provided for the following record counts:

\- 100

\- 1,000

\- 10,000

\- 50,000

\- 100,000



Each record contains bill date, bill ID, consumer ID, transaction ID, generated units, consumed units, payable amount, and electricity tariff.



\## Repository Structure

\- `datasets/` — Shared synthetic datasets

\- `ethereum/` — Ethereum smart contract and benchmarks

\- `hyperledger-fabric/` — Hyperledger Fabric implementation

\- `results/` — Comparative results

\- `figures/` — Research graphs and figures

\- `documentation/` — Research documentation



\## Implementations



\### Ethereum

Solidity smart contract implementation using Hardhat and Ethers.js.



\### Hyperledger Fabric

Private blockchain implementation using chaincode. Implementation files will be added here.



\## Benchmark Dataset Sizes

100, 1,000, 10,000, 50,000, and 100,000 records.



\## Project Status

Research implementation and benchmarking repository under development.



\## Data Disclaimer

The datasets included in this repository are synthetic and intended for academic benchmarking. No real consumer billing information should be included.



\## License

No license has been assigned to this repository yet.

