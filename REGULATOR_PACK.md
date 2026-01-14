# Regulator Pack: Technical Brief for Audit & Attestation Infrastructure

## Executive Summary

This document provides a comprehensive technical overview of the deterministic scoring, canonicalization, and attestation infrastructure implemented for auditable and reproducible evidence generation. This infrastructure supports regulatory compliance, transparency, and third-party verification.

## 1. Deterministic Scoring Engine

### Overview
The scoring engine produces consistent, reproducible results using deterministic algorithms that ensure:
- **Identical inputs always produce identical outputs**
- **No randomness or time-based variations**
- **Cryptographically verifiable score integrity**

### Key Properties
- **Determinism**: All score calculations use fixed algorithms with no random elements
- **Reproducibility**: Any party can re-run scoring with the same inputs to verify results
- **Auditability**: Complete audit trail from raw data to final score

## 2. Canonicalization Process

### Purpose
Canonicalization ensures that score data has a single, standardized representation for cryptographic verification.

### Implementation
- **JSON Standardization**: Uses `fast-json-stable-stringify` to create consistent JSON output
- **Field Ordering**: All JSON fields sorted alphabetically
- **Whitespace Normalization**: Consistent formatting without insignificant whitespace variations
- **Unicode Handling**: Proper encoding of special characters

### Canonical Score Format
```json
{
  "engineVersion": "1.0.0",
  "score": 850,
  "scoreId": "unique-identifier",
  "timestamp": "2026-01-14T00:00:00Z",
  "metadata": {
    "factors": {...}
  }
}
```

## 3. Evidence Artifacts

### Generated Artifacts

#### 3.1 Canonical Score JSONs
- Location: `./scores/`
- Format: Canonicalized JSON files
- Naming: `{scoreId}_canonical.json`
- Purpose: Immutable record of each score

#### 3.2 Merkle Proofs
- File: `./scores/proofs.json`
- Contents:
  - `merkleRoot`: Root hash of all scores
  - `proofs`: Per-score Merkle inclusion proofs
- Algorithm: SHA-256 based Merkle tree (merkletreejs)

#### 3.3 Anchor Mapping
- File: `./scores/anchor_mapping.json`
- Contents: Maps merkleRoot to blockchain transaction
- Fields:
  - `merkleRoot`: Computed root hash
  - `txHash`: Blockchain transaction hash
  - `blockNumber`: Block number of anchoring
  - `timestamp`: Anchoring timestamp
  - `contractAddress`: AnchorRegistry contract address

#### 3.4 Attestation Records
- File: `./scores/antigravity_attestation.json` (when using third-party attestation)
- Contents: Third-party attestation response
- Purpose: Independent verification by external authority

### 3.5 Engine Signatures
Each canonical score is signed by the scoring engine's private key:
- **Algorithm**: ECDSA (Ethereum-compatible)
- **Signature**: Appended to canonical JSON or stored separately
- **Verification**: Public key available for independent verification

## 4. Reproducibility Steps

### Prerequisites
```bash
# Required software
node >= 14.x
npm >= 6.x
git
```

### Step-by-Step Reproduction

#### Step 1: Clone Repository
```bash
git clone https://github.com/drosser895-eng/precisionpaintpartners-website.git
cd precisionpaintpartners-website
npm install
```

#### Step 2: Verify Canonical Scores
```bash
# Review canonical score files
ls -l ./scores/*_canonical.json

# Inspect a specific score
cat ./scores/{scoreId}_canonical.json | jq .
```

#### Step 3: Generate Merkle Proofs
```bash
node generate_proofs.js
# Output: ./scores/proofs.json
# Verify merkleRoot matches anchor_mapping.json
```

#### Step 4: Verify Against Blockchain
```bash
# Set environment variables
export RPC_URL="https://mainnet.infura.io/v3/YOUR_KEY"
export ANCHOR_CONTRACT="0x..."

# Run verification
node verify_score_client.js --scoreId {scoreId}
```

#### Step 5: Verify Engine Signature
The verification script automatically checks:
- Canonical score hash matches computed hash
- Engine signature is valid for the canonical score
- Score is included in the Merkle tree
- Merkle root is anchored on-chain

## 5. Deliverables

### 5.1 Documentation
- ✅ `REGULATOR_PACK.md` - This document
- ✅ `CONTRACT_DEPLOY_PLAYBOOK.md` - Deployment procedures
- ✅ `PROOFS_README.md` - Proof generation instructions
- ✅ `ANTIGRAVITY_INTEGRATION.md` - Third-party attestation integration

### 5.2 Scripts & Tools
- ✅ `generate_proofs.js` - Merkle proof generation
- ✅ `verify_score_client.js` - Comprehensive verification tool
- ✅ `antigravity_adapter.js` - Third-party attestation adapter
- ✅ `monitoring_alerts.js` - Continuous monitoring

### 5.3 CI/CD Infrastructure
- ✅ `.github/workflows/ci.yml` - Automated testing and build
- ✅ `.github/workflows/anchor-monitor.yml` - Scheduled monitoring
- ✅ Deployment configs (netlify.toml, vercel.json)

### 5.4 Evidence Package
For regulatory review, the following artifacts are provided:
- All canonical score JSON files (`./scores/`)
- Merkle proofs (`./scores/proofs.json`)
- Blockchain anchor mapping (`./scores/anchor_mapping.json`)
- Third-party attestations (when applicable)
- Transaction receipts and block confirmations
- Source code with commit hash

## 6. Security Considerations

### 6.1 Key Management
- **Private Keys**: Stored securely in GitHub Secrets, never in repository
- **Rotation**: Regular key rotation procedures documented
- **Multi-signature**: Support for multisig contracts (see CONTRACT_DEPLOY_PLAYBOOK.md)

### 6.2 Blockchain Security
- **Testnet First**: All deployments tested on testnet before mainnet
- **Immutability**: Anchored data cannot be altered
- **Public Verification**: Anyone can verify anchored data

### 6.3 Data Integrity
- **Cryptographic Hashing**: SHA-256 for all content hashing
- **Merkle Trees**: Efficient verification of large datasets
- **Digital Signatures**: ECDSA signatures for authenticity

## 7. Compliance & Audit Support

### Audit Trail Components
1. **Source Data Lineage**: Track data from origin to canonical form
2. **Transformation Logs**: Record all data processing steps
3. **Cryptographic Proofs**: Immutable evidence of data integrity
4. **Blockchain Records**: Permanent, timestamped anchoring
5. **Third-Party Attestation**: Independent verification (optional)

### Regulatory Queries
For regulatory inquiries, auditors can:
- Independently verify any score using provided scripts
- Review blockchain transactions for timestamp verification
- Validate Merkle proofs for data inclusion
- Confirm third-party attestations
- Reproduce scoring results with original inputs

## 8. Contact & Support

### Technical Contacts
- **Primary**: See repository CODEOWNERS
- **Security**: security@example.com
- **Compliance**: compliance@example.com

### Resources
- Repository: https://github.com/drosser895-eng/precisionpaintpartners-website
- Documentation: See repository docs/
- Issue Tracker: GitHub Issues

## 9. Glossary

- **Canonical Score**: Standardized, immutable representation of a score
- **Merkle Root**: Cryptographic hash representing all scores in the tree
- **Anchoring**: Process of recording the merkleRoot on blockchain
- **Attestation**: Third-party verification and certification
- **AnchorRegistry**: Smart contract storing merkleRoots on-chain
- **HMAC**: Hash-based Message Authentication Code for API security

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-14  
**Status**: Active
