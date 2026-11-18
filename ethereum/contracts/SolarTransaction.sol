
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SolarTransaction {
    struct Transaction {
        uint32 billDate;
        uint32 billId;
        uint32 consumerId;
        uint32 transactionId;
        uint256 unitsGenerated;
        uint256 unitsConsumed;
        uint256 amountPayablePaise;
        uint256 electricityRatePaise;
        bytes32 dataHash;
    }

    mapping(uint32 => Transaction) private transactions;

    mapping(uint32 => bool) public transactionExists;

    uint256 public totalTransactions;

    event TransactionStored(
        uint32 indexed transactionId,
        uint32 indexed billId,
        uint32 indexed consumerId,
        bytes32 dataHash
    );

    error InvalidId();
    error DuplicateTransaction();
    error TransactionNotFound();
    error InvalidHash();

    function storeTransaction(
        uint32 billDate,
        uint32 billId,
        uint32 consumerId,
        uint32 transactionId,
        uint256 unitsGenerated,
        uint256 unitsConsumed,
        uint256 amountPayablePaise,
        uint256 electricityRatePaise
    ) external {
        if (
            billId < 100000 ||
            billId > 999999 ||
            consumerId < 100000 ||
            consumerId > 999999 ||
            transactionId < 100000 ||
            transactionId > 999999
        ) {
            revert InvalidId();
        }

        if (transactionExists[transactionId]) {
            revert DuplicateTransaction();
        }

        bytes32 calculatedHash = calculateHash(
            billDate,
            billId,
            consumerId,
            transactionId,
            unitsGenerated,
            unitsConsumed,
            amountPayablePaise,
            electricityRatePaise
        );

        transactions[transactionId] = Transaction({
            billDate: billDate,
            billId: billId,
            consumerId: consumerId,
            transactionId: transactionId,
            unitsGenerated: unitsGenerated,
            unitsConsumed: unitsConsumed,
            amountPayablePaise: amountPayablePaise,
            electricityRatePaise: electricityRatePaise,
            dataHash: calculatedHash
        });

        transactionExists[transactionId] = true;
        totalTransactions++;

        emit TransactionStored(
            transactionId,
            billId,
            consumerId,
            calculatedHash
        );
    }

    function getTransaction(
        uint32 transactionId
    ) external view returns (Transaction memory) {
        if (!transactionExists[transactionId]) {
            revert TransactionNotFound();
        }

        return transactions[transactionId];
    }

    function verifyTransaction(
        uint32 transactionId,
        bytes32 expectedHash
    ) external view returns (bool) {
        if (!transactionExists[transactionId]) {
            revert TransactionNotFound();
        }

        Transaction storage txn = transactions[transactionId];

        bytes32 calculatedHash = calculateHash(
            txn.billDate,
            txn.billId,
            txn.consumerId,
            txn.transactionId,
            txn.unitsGenerated,
            txn.unitsConsumed,
            txn.amountPayablePaise,
            txn.electricityRatePaise
        );

        if (
            calculatedHash != txn.dataHash ||
            expectedHash != txn.dataHash
        ) {
            revert InvalidHash();
        }

        return true;
    }

    function calculateHash(
        uint32 billDate,
        uint32 billId,
        uint32 consumerId,
        uint32 transactionId,
        uint256 unitsGenerated,
        uint256 unitsConsumed,
        uint256 amountPayablePaise,
        uint256 electricityRatePaise
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                billDate,
                billId,
                consumerId,
                transactionId,
                unitsGenerated,
                unitsConsumed,
                amountPayablePaise,
                electricityRatePaise
            )
        );
    }
}
