# AnchorRegistry Contract Deployment & Security Playbook

## Overview

This playbook provides step-by-step procedures for deploying the AnchorRegistry smart contract from testnet to mainnet, including security best practices, audit steps, and operational runbook commands.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Testnet Deployment](#testnet-deployment)
3. [Security Audit Steps](#security-audit-steps)
4. [Mainnet Deployment](#mainnet-deployment)
5. [Multisig & Timelock Configuration](#multisig--timelock-configuration)
6. [Operational Runbook](#operational-runbook)
7. [Emergency Procedures](#emergency-procedures)

---

## Pre-Deployment Checklist

### Prerequisites
- [ ] Solidity compiler version verified (recommend 0.8.19+)
- [ ] Smart contract code reviewed and tested
- [ ] Test suite passes with 100% coverage
- [ ] Security audit completed (internal/external)
- [ ] Gas optimization review completed
- [ ] Deployment wallet funded with sufficient ETH/MATIC
- [ ] RPC endpoints configured and tested
- [ ] Multisig wallet addresses confirmed
- [ ] Timelock duration agreed upon (recommend 24-48 hours)

### Required Tools
```bash
# Install dependencies
npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
npm install @openzeppelin/contracts

# Verify installations
npx hardhat --version
```

### Environment Setup
```bash
# Copy sample environment file
cp .env.sample .env

# Configure required variables
# Edit .env with your values:
# - ETH_PRIVATE_KEY (deployment wallet)
# - RPC_URL (testnet/mainnet endpoint)
# - ETHERSCAN_API_KEY (for verification)
```

---

## Testnet Deployment

### Supported Testnets
- **Ethereum**: Sepolia, Goerli
- **Polygon**: Mumbai
- **Optimism**: Optimism Goerli
- **Arbitrum**: Arbitrum Goerli

### Deployment Steps

#### 1. Configure Hardhat
Create `hardhat.config.js`:
```javascript
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");

module.exports = {
  solidity: "0.8.19",
  networks: {
    sepolia: {
      url: process.env.RPC_URL,
      accounts: [process.env.ETH_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
```

#### 2. Deploy to Testnet
```bash
# Deploy AnchorRegistry
npx hardhat run scripts/deploy.js --network sepolia

# Expected output:
# AnchorRegistry deployed to: 0x1234...5678
# Transaction hash: 0xabcd...ef01
# Deployer address: 0x9876...5432
```

#### 3. Verify Contract
```bash
# Verify on Etherscan
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS

# Manual verification if needed
# Go to https://sepolia.etherscan.io
# Submit source code for verification
```

#### 4. Test Anchoring on Testnet
```bash
# Set testnet contract address
export ANCHOR_CONTRACT="0x1234...5678"
export RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"

# Perform test anchoring
node scripts/anchor_test.js

# Verify transaction on block explorer
```

---

## Security Audit Steps

### Internal Audit Checklist

#### Code Review
- [ ] Access controls properly implemented
- [ ] ReentrancyGuard used where needed
- [ ] Integer overflow/underflow protections (Solidity 0.8+)
- [ ] Proper event emission for all state changes
- [ ] No delegatecall to untrusted contracts
- [ ] No selfdestruct functionality
- [ ] Gas limits considered for loops

#### Function-Level Review
- [ ] `anchorRoot()` - Only callable by authorized addresses
- [ ] `verifyAnchor()` - Public view function works correctly
- [ ] `updateOwner()` - Protected by timelock (if applicable)
- [ ] All functions have appropriate visibility modifiers

#### Testing
```bash
# Run comprehensive test suite
npx hardhat test

# Coverage report
npx hardhat coverage

# Gas reporter
REPORT_GAS=true npx hardhat test
```

### External Audit

#### Recommended Auditors
- Trail of Bits
- ConsenSys Diligence
- OpenZeppelin
- CertiK

#### Audit Scope
Provide auditors with:
- Contract source code
- Test suite
- Documentation
- Deployment plan
- Expected usage patterns

#### Remediation
- [ ] Address all critical findings before mainnet
- [ ] Document medium/low findings and mitigation plans
- [ ] Re-audit if significant changes made

---

## Mainnet Deployment

### Pre-Mainnet Checklist
- [ ] Testnet deployment successful for 7+ days
- [ ] All test scenarios passed
- [ ] Security audit completed with no critical issues
- [ ] Mainnet deployment wallet funded
- [ ] Multisig signers confirmed and available
- [ ] Deployment transaction parameters finalized
- [ ] Rollback plan documented

### Mainnet Deployment Procedure

#### 1. Final Configuration Review
```bash
# Verify all parameters
cat .env | grep -v PRIVATE_KEY

# Verify deployer address has sufficient funds
# Ethereum Mainnet: Minimum 0.5 ETH recommended
# Polygon Mainnet: Minimum 50 MATIC recommended
```

#### 2. Deploy to Mainnet
```bash
# CRITICAL: Triple-check network configuration
export NETWORK="mainnet"
export RPC_URL="https://mainnet.infura.io/v3/YOUR_KEY"

# Deploy
npx hardhat run scripts/deploy.js --network mainnet

# SAVE DEPLOYMENT DETAILS IMMEDIATELY
# Contract Address: 
# Transaction Hash:
# Block Number:
# Gas Used:
```

#### 3. Verify Deployment
```bash
# Verify on Etherscan
npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS

# Manual verification of contract state
node scripts/verify_deployment.js
```

#### 4. Transfer Ownership to Multisig
```bash
# Transfer to multisig/timelock (see next section)
node scripts/transfer_ownership.js --multisig 0xMULTISIG_ADDRESS
```

---

## Multisig & Timelock Configuration

### Multisig Setup (Gnosis Safe)

#### 1. Create Multisig Wallet
- Go to https://gnosis-safe.io/app/
- Select network (Ethereum, Polygon, etc.)
- Create new Safe
- Add signers (3-5 recommended)
- Set threshold (e.g., 2-of-3, 3-of-5)

#### 2. Transfer Contract Ownership
```javascript
// scripts/transfer_ownership.js
const contract = await ethers.getContractAt("AnchorRegistry", CONTRACT_ADDRESS);
const tx = await contract.transferOwnership(MULTISIG_ADDRESS);
await tx.wait();
console.log("Ownership transferred to:", MULTISIG_ADDRESS);
```

### Timelock Configuration

#### Timelock Parameters
```javascript
const TIMELOCK_DELAY = 86400 * 2; // 48 hours
const PROPOSER_ROLE = multisigAddress;
const EXECUTOR_ROLE = multisigAddress;
```

#### Deploy Timelock
```bash
# Deploy TimelockController
npx hardhat run scripts/deploy_timelock.js --network mainnet

# Configure AnchorRegistry to use Timelock
node scripts/setup_timelock.js
```

---

## Operational Runbook

### Anchoring a Merkle Root

```bash
# 1. Generate proofs
node generate_proofs.js

# 2. Extract merkleRoot from proofs.json
export MERKLE_ROOT=$(jq -r '.merkleRoot' ./scores/proofs.json)

# 3. Anchor on-chain
node scripts/anchor.js --merkleRoot $MERKLE_ROOT

# 4. Verify anchoring
node verify_score_client.js
```

### Querying Anchored Data

```bash
# Get anchor by merkleRoot
node scripts/query_anchor.js --merkleRoot 0xabc123...

# Get all anchors
node scripts/list_anchors.js

# Verify specific score
node verify_score_client.js --scoreId {scoreId}
```

### Monitoring

```bash
# Check anchor status
node monitoring_alerts.js

# Schedule monitoring (see .github/workflows/anchor-monitor.yml)
# Runs automatically via GitHub Actions
```

### Gas Estimation

```bash
# Estimate gas for anchoring
node scripts/estimate_gas.js --merkleRoot 0xabc123...

# Expected gas costs (approximate):
# Ethereum: 50,000-100,000 gas
# Polygon: Similar gas units, much lower USD cost
```

---

## Emergency Procedures

### Contract Pause (if implemented)

```bash
# Pause contract operations
node scripts/pause_contract.js

# Requires multisig approval
# Emergency contacts should be notified
```

### Incident Response

#### 1. Detection
- Monitor for unusual transactions
- Set up alerts for contract events
- Regular audit log reviews

#### 2. Assessment
- Determine severity (critical/high/medium/low)
- Identify affected functionality
- Estimate impact scope

#### 3. Containment
- Pause contract if necessary
- Prevent further damage
- Preserve evidence

#### 4. Communication
- Notify stakeholders
- Public disclosure if required
- Regulatory notification if applicable

#### 5. Recovery
- Deploy fixes if needed
- Resume operations gradually
- Post-mortem analysis

### Rollback Plan

If critical issues are discovered post-deployment:
1. Pause contract (if pause functionality exists)
2. Deploy new contract version
3. Migrate data if necessary
4. Update all references to new contract address
5. Deprecate old contract

### Support Contacts

- **Deployment Team**: dev-team@example.com
- **Security Team**: security@example.com
- **Multisig Signers**: [List contact methods]
- **On-call Rotation**: [PagerDuty/Opsgenie link]

---

## Appendix

### A. Sample Contract Interface

```solidity
interface IAnchorRegistry {
    event RootAnchored(bytes32 indexed merkleRoot, address indexed anchor, uint256 timestamp);
    
    function anchorRoot(bytes32 merkleRoot) external;
    function verifyAnchor(bytes32 merkleRoot) external view returns (bool, uint256);
    function getAnchor(bytes32 merkleRoot) external view returns (address, uint256);
}
```

### B. Network Addresses

| Network | Contract Address | Multisig Address |
|---------|-----------------|------------------|
| Sepolia Testnet | TBD | TBD |
| Ethereum Mainnet | TBD | TBD |
| Polygon Mainnet | TBD | TBD |

### C. Useful Commands

```bash
# Check contract code
cast code $ANCHOR_CONTRACT --rpc-url $RPC_URL

# Get contract owner
cast call $ANCHOR_CONTRACT "owner()(address)" --rpc-url $RPC_URL

# Check anchor status
cast call $ANCHOR_CONTRACT "verifyAnchor(bytes32)(bool,uint256)" $MERKLE_ROOT --rpc-url $RPC_URL
```

---

**Playbook Version**: 1.0  
**Last Updated**: 2026-01-14  
**Review Date**: Quarterly  
**Status**: Active
