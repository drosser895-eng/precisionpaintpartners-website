# Proof Generation & Verification

This guide explains how to generate Merkle proofs for canonical scores and verify them against the blockchain-anchored root.

## Overview

The proof system consists of two main scripts:

1. **`generate_proofs.js`** - Generates Merkle tree and proofs from canonical scores
2. **`verify_score_client.js`** - Verifies a score against proofs and on-chain anchor

## Prerequisites

### Install Dependencies

```bash
npm install merkletreejs fast-json-stable-stringify ethers
```

### Environment Setup

Create a `.env` file (or copy from `.env.sample`):

```bash
# Blockchain Configuration
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
ANCHOR_CONTRACT=0x742d35Cc6634C0532925a3b844Bc454e4438f44e

# Optional: For anchoring operations (keep private!)
PRIVATE_KEY=your_private_key_here
```

### Directory Structure

Ensure your scores directory exists with canonical score files:

```
./scores/
  ├── score_001_canonical.json
  ├── score_002_canonical.json
  ├── score_003_canonical.json
  └── ...
```

---

## Generating Proofs

### Basic Usage

```bash
node generate_proofs.js
```

### What It Does

1. **Reads Canonical Scores**: Scans `./scores/` for `*_canonical.json` files
2. **Computes Score Hashes**: Uses SHA-256 to hash each canonical score
3. **Builds Merkle Tree**: Constructs a Merkle tree from all score hashes
4. **Generates Proofs**: Creates a Merkle proof for each score
5. **Writes Output**: Saves results to `./scores/proofs.json`

### Output Format

`./scores/proofs.json`:

```json
{
  "merkleRoot": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  "treeDepth": 8,
  "totalScores": 150,
  "generatedAt": "2026-01-14T12:00:00Z",
  "proofs": {
    "score_001": {
      "scoreHash": "0xabc123...",
      "proof": [
        "0xdef456...",
        "0x789abc...",
        "0x321fed..."
      ],
      "position": "left"
    },
    "score_002": {
      "scoreHash": "0x456def...",
      "proof": [
        "0x987cba...",
        "0x654fed...",
        "0xabc123..."
      ],
      "position": "right"
    }
  }
}
```

### Advanced Options

The script supports command-line arguments:

```bash
# Specify custom scores directory
node generate_proofs.js --scoresDir ./custom/scores

# Specify custom output file
node generate_proofs.js --output ./custom/proofs.json

# Use different hash algorithm (default: sha256)
node generate_proofs.js --hashAlgo sha512
```

### Verification

After generation, the script automatically verifies all proofs:

```bash
✓ Generated Merkle tree with 150 scores
✓ Merkle root: 0x1a2b3c...
✓ Verified 150/150 proofs successfully
✓ Written to ./scores/proofs.json
```

---

## Verifying Scores

### Basic Usage

Verify a specific score:

```bash
node verify_score_client.js --scoreId score_001
```

### Full Verification Process

The script performs multiple verification steps:

#### 1. Local Verification
- ✅ Canonical score file exists
- ✅ Score hash matches computed hash
- ✅ Proof exists in `proofs.json`
- ✅ Merkle proof is valid for the computed root

#### 2. On-Chain Verification
- ✅ Merkle root is anchored on blockchain
- ✅ Anchor timestamp is valid
- ✅ Anchor contract is correct

#### 3. Output

Successful verification:

```bash
✓ Score File: ./scores/score_001_canonical.json
✓ Score Hash: 0xabc123...
✓ Merkle Root: 0x1a2b3c...
✓ Local Proof: VALID
✓ On-Chain Anchor: FOUND
  - Block: 16500000
  - Timestamp: 2026-01-14 10:30:00 UTC
  - Contract: 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
✓ VERIFICATION SUCCESSFUL

All checks passed. This score is cryptographically verified.
```

Failed verification:

```bash
✗ Score File: ./scores/score_001_canonical.json
✓ Score Hash: 0xabc123...
✓ Merkle Root: 0x1a2b3c...
✓ Local Proof: VALID
✗ On-Chain Anchor: NOT FOUND

VERIFICATION FAILED

The Merkle root is not anchored on the blockchain.
This score cannot be independently verified.
```

### Command-Line Options

```bash
# Verify specific score
node verify_score_client.js --scoreId score_001

# Verify all scores
node verify_score_client.js --all

# Use custom RPC endpoint
node verify_score_client.js --scoreId score_001 --rpc https://custom-rpc.example.com

# Use custom contract address
node verify_score_client.js --scoreId score_001 --contract 0xCustomContract...

# Verbose output
node verify_score_client.js --scoreId score_001 --verbose

# JSON output (for automation)
node verify_score_client.js --scoreId score_001 --json
```

### JSON Output Format

With `--json` flag:

```json
{
  "scoreId": "score_001",
  "verified": true,
  "scoreHash": "0xabc123...",
  "merkleRoot": "0x1a2b3c...",
  "localProof": {
    "valid": true
  },
  "onChainAnchor": {
    "found": true,
    "blockNumber": 16500000,
    "timestamp": "2026-01-14T10:30:00Z",
    "txHash": "0xfedcba...",
    "contractAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
  },
  "verifiedAt": "2026-01-14T15:45:30Z"
}
```

---

## Integration Examples

### Python Integration

```python
import subprocess
import json

def verify_score(score_id):
    result = subprocess.run(
        ['node', 'verify_score_client.js', '--scoreId', score_id, '--json'],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

# Use it
verification = verify_score('score_001')
if verification['verified']:
    print(f"Score {verification['scoreId']} is verified!")
else:
    print(f"Verification failed for {verification['scoreId']}")
```

### Shell Script Integration

```bash
#!/bin/bash

# Verify all scores and report failures
node verify_score_client.js --all --json > verification_results.json

# Check for failures
failures=$(jq '[.[] | select(.verified == false)] | length' verification_results.json)

if [ "$failures" -gt 0 ]; then
    echo "⚠️  $failures scores failed verification"
    jq '.[] | select(.verified == false) | .scoreId' verification_results.json
    exit 1
else
    echo "✓ All scores verified successfully"
    exit 0
fi
```

### CI/CD Integration

In `.github/workflows/ci.yml`:

```yaml
- name: Verify Scores
  run: |
    node generate_proofs.js
    node verify_score_client.js --all
  env:
    RPC_URL: ${{ secrets.RPC_URL }}
    ANCHOR_CONTRACT: ${{ secrets.ANCHOR_CONTRACT }}
```

---

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module 'merkletreejs'"

**Solution**: Install dependencies
```bash
npm install merkletreejs fast-json-stable-stringify ethers
```

#### Issue: "No canonical score files found"

**Solution**: Ensure scores directory exists and contains `*_canonical.json` files
```bash
ls -l ./scores/*_canonical.json
```

#### Issue: "RPC connection failed"

**Solution**: Check RPC URL and network connectivity
```bash
# Test RPC endpoint
curl -X POST $RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

#### Issue: "Merkle root not found on chain"

**Solution**: Verify anchoring was completed
```bash
# Check anchor_mapping.json exists
cat ./scores/anchor_mapping.json

# Verify transaction on block explorer
# Use txHash from anchor_mapping.json
```

#### Issue: "Proof verification failed locally"

**Possible causes**:
- Canonical score file was modified after proof generation
- Proofs file is outdated
- Score file is corrupted

**Solution**: Regenerate proofs
```bash
node generate_proofs.js
```

---

## Best Practices

### 1. Generate Proofs After All Scores Are Final

Don't generate proofs for incomplete score sets. Wait until all canonical scores are ready.

### 2. Anchor Before Distribution

Always anchor the Merkle root on-chain before distributing scores or proofs.

### 3. Keep Proofs with Scores

Store `proofs.json` alongside canonical scores in the same directory.

### 4. Version Control

Commit proofs and anchor mapping to git:
```bash
git add ./scores/proofs.json ./scores/anchor_mapping.json
git commit -m "Add Merkle proofs and anchor mapping"
```

### 5. Backup Anchor Mapping

The `anchor_mapping.json` file is critical. Keep backups:
```bash
cp ./scores/anchor_mapping.json ./backups/anchor_mapping_$(date +%Y%m%d).json
```

### 6. Automate Verification

Run verification regularly in CI/CD to catch issues early.

### 7. Document Score Lifecycle

For each score set, document:
- Generation date
- Proof generation date
- Anchoring date and transaction
- Any third-party attestations

---

## Script Reference

### generate_proofs.js

**Inputs**:
- `./scores/*_canonical.json` - Canonical score files

**Outputs**:
- `./scores/proofs.json` - Merkle proofs and root

**Dependencies**:
- `merkletreejs` - Merkle tree construction
- `fast-json-stable-stringify` - Canonical JSON hashing

### verify_score_client.js

**Inputs**:
- `./scores/{scoreId}_canonical.json` - Score to verify
- `./scores/proofs.json` - Merkle proofs
- Environment: `RPC_URL`, `ANCHOR_CONTRACT`

**Outputs**:
- Console output (or JSON with `--json` flag)
- Exit code: 0 (success) or 1 (failure)

**Dependencies**:
- `ethers` - Blockchain interaction
- `merkletreejs` - Proof verification
- `fast-json-stable-stringify` - Hash computation

---

## Additional Resources

- [Merkle Tree Specification](https://en.wikipedia.org/wiki/Merkle_tree)
- [Ethers.js Documentation](https://docs.ethers.org/)
- [AnchorRegistry Contract](./CONTRACT_DEPLOY_PLAYBOOK.md)
- [Canonical Score Format](./REGULATOR_PACK.md)

---

**Last Updated**: 2026-01-14  
**Version**: 1.0
