#!/usr/bin/env node

/**
 * Generate Merkle Proofs
 * 
 * Reads canonical score JSONs from ./scores, computes scoreHash for each,
 * builds a Merkle tree, and writes proofs.json with merkleRoot and per-file proofs.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Check for required dependencies
let MerkleTree, stringify;
try {
  const merkletreejs = require('merkletreejs');
  MerkleTree = merkletreejs.MerkleTree;
  stringify = require('fast-json-stable-stringify');
} catch (error) {
  console.error('❌ Missing required dependencies!');
  console.error('   Please install: npm install merkletreejs fast-json-stable-stringify');
  process.exit(1);
}

// Configuration
const SCORES_DIR = process.env.SCORES_DIR || path.join(__dirname, 'scores');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(SCORES_DIR, 'proofs.json');
const HASH_ALGO = process.env.HASH_ALGO || 'sha256';

/**
 * Compute SHA-256 hash of data
 */
function hashData(data) {
  return crypto.createHash(HASH_ALGO).update(data).digest();
}

/**
 * Main execution function
 */
async function main() {
  console.log('🌳 Merkle Proof Generator');
  console.log('==========================\n');

  // Ensure scores directory exists
  if (!fs.existsSync(SCORES_DIR)) {
    console.error(`❌ Error: Scores directory not found at ${SCORES_DIR}`);
    console.error('   Create the directory and add canonical score JSON files.');
    process.exit(1);
  }

  console.log(`📂 Reading canonical scores from: ${SCORES_DIR}\n`);

  // Find all canonical score files
  const files = fs.readdirSync(SCORES_DIR)
    .filter(f => f.endsWith('_canonical.json'))
    .sort(); // Ensure consistent ordering

  if (files.length === 0) {
    console.error('❌ Error: No canonical score files found');
    console.error('   Files should be named like: score_001_canonical.json');
    process.exit(1);
  }

  console.log(`✓ Found ${files.length} canonical score file(s)\n`);

  // Read and hash each score
  const scores = [];
  const hashes = [];
  const scoreData = {};

  console.log('🔢 Computing score hashes...\n');

  for (const file of files) {
    const filePath = path.join(SCORES_DIR, file);
    const scoreId = file.replace('_canonical.json', '');
    
    try {
      // Read file
      const content = fs.readFileSync(filePath, 'utf8');
      const score = JSON.parse(content);
      
      // Canonicalize (ensures consistent ordering)
      const canonical = stringify(score);
      
      // Compute hash
      const hash = hashData(canonical);
      const hashHex = '0x' + hash.toString('hex');
      
      scores.push({ id: scoreId, file, score, canonical });
      hashes.push(hash);
      scoreData[scoreId] = {
        file,
        scoreHash: hashHex,
        canonical
      };
      
      console.log(`   ✓ ${scoreId}`);
      console.log(`     Hash: ${hashHex}`);
      
    } catch (error) {
      console.error(`   ❌ Error processing ${file}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('\n🌲 Building Merkle tree...\n');

  // Build Merkle tree
  const merkleTree = new MerkleTree(hashes, crypto.createHash(HASH_ALGO), {
    sortPairs: true,
    hashLeaves: false // We already hashed the leaves
  });

  const merkleRoot = '0x' + merkleTree.getRoot().toString('hex');
  console.log(`   ✓ Merkle root: ${merkleRoot}`);
  console.log(`   ✓ Tree depth: ${merkleTree.getDepth()}`);
  console.log(`   ✓ Leaf count: ${merkleTree.getLeafCount()}\n`);

  // Generate proofs for each score
  console.log('🔐 Generating Merkle proofs...\n');

  const proofs = {};

  for (let i = 0; i < scores.length; i++) {
    const { id } = scores[i];
    const hash = hashes[i];
    
    // Get proof
    const proof = merkleTree.getProof(hash);
    const proofHex = proof.map(p => '0x' + p.data.toString('hex'));
    
    // Verify proof locally
    const verified = merkleTree.verify(proof, hash, merkleTree.getRoot());
    
    proofs[id] = {
      scoreHash: scoreData[id].scoreHash,
      proof: proofHex,
      verified
    };
    
    console.log(`   ✓ ${id}: ${verified ? 'verified' : 'FAILED'}`);
  }

  // Prepare output
  const output = {
    merkleRoot,
    treeDepth: merkleTree.getDepth(),
    totalScores: scores.length,
    generatedAt: new Date().toISOString(),
    algorithm: HASH_ALGO,
    proofs
  };

  // Write to file
  console.log(`\n💾 Writing proofs to: ${OUTPUT_FILE}\n`);

  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log('✓ Proofs file created successfully\n');
  } catch (error) {
    console.error(`❌ Error writing proofs file: ${error.message}`);
    process.exit(1);
  }

  // Verify all proofs one more time
  console.log('✅ Verification Summary:');
  const allVerified = Object.values(proofs).every(p => p.verified);
  
  if (allVerified) {
    console.log(`   ✓ All ${scores.length} proofs verified successfully!`);
    console.log(`   ✓ Merkle root: ${merkleRoot}`);
    console.log(`   ✓ Output: ${OUTPUT_FILE}\n`);
    
    console.log('🎉 Proof generation completed successfully!\n');
    console.log('Next steps:');
    console.log('   1. Anchor the merkleRoot on blockchain');
    console.log('   2. Run verify_score_client.js to verify individual scores');
    console.log('   3. Include proofs.json in your evidence package\n');
    
    process.exit(0);
  } else {
    console.error('   ❌ Some proofs failed verification!');
    process.exit(1);
  }
}

/**
 * Verify a single proof (utility function for external use)
 */
function verifySingleProof(scoreHash, proof, merkleRoot) {
  const hashFunction = (data) => {
    if (typeof data === 'string' && data.startsWith('0x')) {
      data = Buffer.from(data.slice(2), 'hex');
    }
    return crypto.createHash(HASH_ALGO).update(data).digest();
  };

  let computedHash = Buffer.from(scoreHash.slice(2), 'hex');

  for (const proofElement of proof) {
    const proofBuffer = Buffer.from(proofElement.slice(2), 'hex');
    
    // Sort pair to match tree construction
    if (computedHash.toString('hex') < proofBuffer.toString('hex')) {
      computedHash = hashFunction(Buffer.concat([computedHash, proofBuffer]));
    } else {
      computedHash = hashFunction(Buffer.concat([proofBuffer, computedHash]));
    }
  }

  const computedRoot = '0x' + computedHash.toString('hex');
  return computedRoot.toLowerCase() === merkleRoot.toLowerCase();
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { hashData, verifySingleProof };
