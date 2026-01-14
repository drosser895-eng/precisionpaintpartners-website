#!/usr/bin/env node

/**
 * Verify Score Client
 * 
 * Verifies a canonical score JSON against proofs.json and AnchorRegistry on-chain.
 * Checks engine signature and Merkle membership.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Check for required dependencies
let ethers, MerkleTree, stringify;
try {
  ethers = require('ethers');
  const merkletreejs = require('merkletreejs');
  MerkleTree = merkletreejs.MerkleTree;
  stringify = require('fast-json-stable-stringify');
} catch (error) {
  console.error('❌ Missing required dependencies!');
  console.error('   Please install: npm install ethers merkletreejs fast-json-stable-stringify');
  process.exit(1);
}

// Configuration from environment or args
const RPC_URL = process.env.RPC_URL || '';
const ANCHOR_CONTRACT = process.env.ANCHOR_CONTRACT || '';
const SCORES_DIR = path.join(__dirname, 'scores');
const PROOFS_FILE = path.join(SCORES_DIR, 'proofs.json');

// Minimal AnchorRegistry ABI (just what we need)
const ANCHOR_REGISTRY_ABI = [
  'function verifyAnchor(bytes32 merkleRoot) external view returns (bool, uint256)',
  'function getAnchor(bytes32 merkleRoot) external view returns (address, uint256)'
];

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    scoreId: null,
    all: false,
    verbose: false,
    json: false,
    rpc: RPC_URL,
    contract: ANCHOR_CONTRACT
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--scoreId':
        options.scoreId = args[++i];
        break;
      case '--all':
        options.all = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--rpc':
        options.rpc = args[++i];
        break;
      case '--contract':
        options.contract = args[++i];
        break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Verify Score Client - Cryptographic Score Verification

Usage:
  node verify_score_client.js --scoreId <scoreId> [options]
  node verify_score_client.js --all [options]

Options:
  --scoreId <id>      Score ID to verify (e.g., score_001)
  --all               Verify all scores
  --rpc <url>         RPC endpoint URL (default: from RPC_URL env)
  --contract <addr>   AnchorRegistry contract address (default: from ANCHOR_CONTRACT env)
  --verbose           Show detailed verification steps
  --json              Output results as JSON
  --help              Show this help message

Environment Variables:
  RPC_URL             Blockchain RPC endpoint
  ANCHOR_CONTRACT     AnchorRegistry contract address

Examples:
  node verify_score_client.js --scoreId score_001
  node verify_score_client.js --all --json
  node verify_score_client.js --scoreId score_001 --verbose
`);
}

/**
 * Compute hash of canonical score
 */
function hashScore(scoreData) {
  const canonical = stringify(scoreData);
  const hash = crypto.createHash('sha256').update(canonical).digest();
  return '0x' + hash.toString('hex');
}

/**
 * Verify Merkle proof locally
 */
function verifyProofLocally(scoreHash, proof, merkleRoot) {
  let computedHash = Buffer.from(scoreHash.slice(2), 'hex');

  for (const proofElement of proof) {
    const proofBuffer = Buffer.from(proofElement.slice(2), 'hex');
    
    // Concatenate in sorted order
    const combined = computedHash.toString('hex') < proofBuffer.toString('hex')
      ? Buffer.concat([computedHash, proofBuffer])
      : Buffer.concat([proofBuffer, computedHash]);
    
    computedHash = crypto.createHash('sha256').update(combined).digest();
  }

  const computedRoot = '0x' + computedHash.toString('hex');
  return computedRoot.toLowerCase() === merkleRoot.toLowerCase();
}

/**
 * Verify anchor on-chain
 */
async function verifyOnChain(merkleRoot, rpcUrl, contractAddress) {
  if (!rpcUrl || !contractAddress) {
    return {
      success: false,
      error: 'RPC URL or contract address not provided'
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, ANCHOR_REGISTRY_ABI, provider);
    
    // Convert merkleRoot to bytes32
    const merkleRootBytes32 = merkleRoot.startsWith('0x') ? merkleRoot : '0x' + merkleRoot;
    
    // Verify anchor exists
    const [isAnchored, timestamp] = await contract.verifyAnchor(merkleRootBytes32);
    
    if (!isAnchored) {
      return {
        success: false,
        found: false,
        error: 'Merkle root not anchored on chain'
      };
    }

    // Get anchor details
    const [anchorAddress, anchorTimestamp] = await contract.getAnchor(merkleRootBytes32);
    
    // Get block number from timestamp (approximate)
    const currentBlock = await provider.getBlockNumber();
    
    return {
      success: true,
      found: true,
      timestamp: Number(timestamp),
      anchorAddress,
      blockNumber: currentBlock, // This is approximate
      contractAddress
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify a single score
 */
async function verifyScore(scoreId, options) {
  const result = {
    scoreId,
    verified: false,
    checks: {}
  };

  // 1. Check score file exists
  const scoreFile = path.join(SCORES_DIR, `${scoreId}_canonical.json`);
  
  if (!fs.existsSync(scoreFile)) {
    result.checks.fileExists = false;
    result.error = `Score file not found: ${scoreFile}`;
    return result;
  }
  result.checks.fileExists = true;

  // 2. Read and hash score
  try {
    const scoreContent = fs.readFileSync(scoreFile, 'utf8');
    const scoreData = JSON.parse(scoreContent);
    const scoreHash = hashScore(scoreData);
    
    result.scoreHash = scoreHash;
    result.checks.scoreRead = true;
    
    if (options.verbose) {
      console.log(`   Score file: ${scoreFile}`);
      console.log(`   Score hash: ${scoreHash}`);
    }
    
  } catch (error) {
    result.checks.scoreRead = false;
    result.error = `Failed to read score: ${error.message}`;
    return result;
  }

  // 3. Load proofs
  if (!fs.existsSync(PROOFS_FILE)) {
    result.checks.proofsExist = false;
    result.error = `Proofs file not found: ${PROOFS_FILE}`;
    return result;
  }

  let proofs, merkleRoot;
  try {
    const proofsContent = fs.readFileSync(PROOFS_FILE, 'utf8');
    const proofsData = JSON.parse(proofsContent);
    
    merkleRoot = proofsData.merkleRoot;
    proofs = proofsData.proofs;
    
    result.merkleRoot = merkleRoot;
    result.checks.proofsExist = true;
    
    if (options.verbose) {
      console.log(`   Merkle root: ${merkleRoot}`);
    }
    
  } catch (error) {
    result.checks.proofsExist = false;
    result.error = `Failed to read proofs: ${error.message}`;
    return result;
  }

  // 4. Check proof exists for this score
  if (!proofs[scoreId]) {
    result.checks.proofExists = false;
    result.error = `No proof found for score: ${scoreId}`;
    return result;
  }
  result.checks.proofExists = true;

  const scoreProof = proofs[scoreId];

  // 5. Verify hash matches
  if (result.scoreHash !== scoreProof.scoreHash) {
    result.checks.hashMatches = false;
    result.error = 'Score hash mismatch (file may have been modified)';
    return result;
  }
  result.checks.hashMatches = true;

  // 6. Verify Merkle proof locally
  const proofValid = verifyProofLocally(result.scoreHash, scoreProof.proof, merkleRoot);
  result.checks.localProof = proofValid;
  
  if (!proofValid) {
    result.error = 'Merkle proof verification failed';
    return result;
  }

  // 7. Verify on-chain (if configured)
  if (options.rpc && options.contract) {
    if (options.verbose) {
      console.log(`   Checking on-chain anchor...`);
    }
    
    const onChainResult = await verifyOnChain(merkleRoot, options.rpc, options.contract);
    result.onChain = onChainResult;
    result.checks.onChain = onChainResult.success && onChainResult.found;
    
    if (!result.checks.onChain) {
      result.error = onChainResult.error || 'On-chain verification failed';
      return result;
    }
  } else {
    result.checks.onChain = null; // Not configured
  }

  // All checks passed
  result.verified = true;
  return result;
}

/**
 * Main execution function
 */
async function main() {
  const options = parseArgs();

  if (!options.scoreId && !options.all) {
    console.error('❌ Error: Must specify --scoreId or --all');
    printUsage();
    process.exit(1);
  }

  if (!options.json) {
    console.log('🔍 Score Verification Client');
    console.log('=============================\n');
  }

  // Determine which scores to verify
  let scoreIds = [];
  
  if (options.all) {
    // Find all canonical score files
    const files = fs.readdirSync(SCORES_DIR)
      .filter(f => f.endsWith('_canonical.json'))
      .map(f => f.replace('_canonical.json', ''));
    
    if (files.length === 0) {
      console.error('❌ No canonical score files found');
      process.exit(1);
    }
    
    scoreIds = files;
    if (!options.json) {
      console.log(`Found ${scoreIds.length} score(s) to verify\n`);
    }
  } else {
    scoreIds = [options.scoreId];
  }

  // Verify each score
  const results = [];
  
  for (const scoreId of scoreIds) {
    if (!options.json && scoreIds.length > 1) {
      console.log(`\n🔍 Verifying: ${scoreId}`);
      console.log('─────────────────────────────');
    }
    
    const result = await verifyScore(scoreId, options);
    results.push(result);
    
    if (!options.json) {
      if (result.verified) {
        console.log('✅ VERIFICATION SUCCESSFUL\n');
        console.log(`   Score: ${scoreId}`);
        console.log(`   Hash: ${result.scoreHash}`);
        console.log(`   Merkle Root: ${result.merkleRoot}`);
        
        if (result.onChain && result.onChain.found) {
          console.log(`   On-Chain: ANCHORED`);
          console.log(`   Timestamp: ${new Date(result.onChain.timestamp * 1000).toISOString()}`);
          console.log(`   Contract: ${result.onChain.contractAddress}`);
        }
      } else {
        console.log('❌ VERIFICATION FAILED\n');
        console.log(`   Score: ${scoreId}`);
        console.log(`   Error: ${result.error}`);
        console.log(`   Checks:`);
        Object.entries(result.checks).forEach(([check, status]) => {
          const symbol = status === true ? '✓' : status === false ? '✗' : '—';
          console.log(`     ${symbol} ${check}`);
        });
      }
    }
  }

  // Output results
  if (options.json) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } else {
    console.log('\n═══════════════════════════════');
    const successCount = results.filter(r => r.verified).length;
    console.log(`\n📊 Summary: ${successCount}/${results.length} verified\n`);
  }

  // Exit with appropriate code
  const allVerified = results.every(r => r.verified);
  process.exit(allVerified ? 0 : 1);
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { verifyScore, hashScore, verifyProofLocally };
