#!/usr/bin/env node

/**
 * Antigravity Attestation Adapter
 * 
 * Reads scores/anchor_mapping.json and POSTs an attestation payload
 * to ANTIGRAVITY_URL with Authorization header and optional HMAC signing.
 * Writes response to scores/antigravity_attestation.json.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Configuration from environment
const ANTIGRAVITY_URL = process.env.ANTIGRAVITY_URL || '';
const ANTIGRAVITY_API_KEY = process.env.ANTIGRAVITY_API_KEY || '';
const ANTIGRAVITY_HMAC_SECRET = process.env.ANTIGRAVITY_HMAC_SECRET || '';

// Paths
const ANCHOR_MAPPING_PATH = path.join(__dirname, 'scores', 'anchor_mapping.json');
const OUTPUT_PATH = path.join(__dirname, 'scores', 'antigravity_attestation.json');

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Antigravity Attestation Adapter');
  console.log('=====================================\n');

  // Validate environment variables
  if (!ANTIGRAVITY_URL) {
    console.error('❌ Error: ANTIGRAVITY_URL environment variable is not set');
    process.exit(1);
  }

  if (!ANTIGRAVITY_API_KEY) {
    console.error('❌ Error: ANTIGRAVITY_API_KEY environment variable is not set');
    process.exit(1);
  }

  // Read anchor mapping
  console.log(`📖 Reading anchor mapping from ${ANCHOR_MAPPING_PATH}`);
  
  if (!fs.existsSync(ANCHOR_MAPPING_PATH)) {
    console.error(`❌ Error: Anchor mapping file not found at ${ANCHOR_MAPPING_PATH}`);
    console.error('   Please complete blockchain anchoring first.');
    process.exit(1);
  }

  let anchorMapping;
  try {
    const anchorData = fs.readFileSync(ANCHOR_MAPPING_PATH, 'utf8');
    anchorMapping = JSON.parse(anchorData);
    console.log('✓ Anchor mapping loaded successfully\n');
  } catch (error) {
    console.error('❌ Error reading anchor mapping:', error.message);
    process.exit(1);
  }

  // Prepare attestation payload
  const payload = {
    merkleRoot: anchorMapping.merkleRoot,
    txHash: anchorMapping.txHash,
    blockNumber: anchorMapping.blockNumber,
    timestamp: anchorMapping.timestamp,
    contractAddress: anchorMapping.contractAddress,
    metadata: {
      repository: 'drosser895-eng/precisionpaintpartners-website',
      scoreCount: anchorMapping.scoreCount || 0,
      engineVersion: anchorMapping.engineVersion || '1.0.0',
      networkName: anchorMapping.networkName || 'mainnet',
      ...(anchorMapping.metadata || {})
    }
  };

  console.log('📦 Preparing attestation payload:');
  console.log(`   Merkle Root: ${payload.merkleRoot}`);
  console.log(`   TX Hash: ${payload.txHash}`);
  console.log(`   Block Number: ${payload.blockNumber}`);
  console.log(`   Contract: ${payload.contractAddress}\n`);

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ANTIGRAVITY_API_KEY}`,
    'User-Agent': 'Antigravity-Adapter/1.0'
  };

  // Add HMAC signature if secret is provided
  if (ANTIGRAVITY_HMAC_SECRET) {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', ANTIGRAVITY_HMAC_SECRET);
    hmac.update(payloadString);
    const signature = hmac.digest('hex');
    headers['X-HMAC-Signature'] = signature;
    console.log('🔐 HMAC signature added for enhanced security\n');
  }

  // Make POST request
  console.log(`🌐 Posting to Antigravity API: ${ANTIGRAVITY_URL}`);
  
  try {
    const response = await postRequest(ANTIGRAVITY_URL, payload, headers);
    console.log('✓ Attestation received successfully\n');

    // Add request metadata to response
    const attestationRecord = {
      ...response,
      request: {
        merkleRoot: payload.merkleRoot,
        txHash: payload.txHash,
        blockNumber: payload.blockNumber,
        timestamp: payload.timestamp,
        contractAddress: payload.contractAddress
      },
      receivedAt: new Date().toISOString()
    };

    // Ensure scores directory exists
    const scoresDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(scoresDir)) {
      fs.mkdirSync(scoresDir, { recursive: true });
    }

    // Write attestation to file
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(attestationRecord, null, 2));
    console.log(`✓ Attestation written to ${OUTPUT_PATH}\n`);

    // Display attestation details
    if (response.success) {
      console.log('📋 Attestation Details:');
      console.log(`   Attestation ID: ${response.attestationId || 'N/A'}`);
      console.log(`   Timestamp: ${response.timestamp || 'N/A'}`);
      console.log(`   Verification URL: ${response.verificationUrl || 'N/A'}`);
      
      if (response.certificate) {
        console.log(`   Certificate Issuer: ${response.certificate.issuer || 'N/A'}`);
        console.log(`   Valid Until: ${response.certificate.validUntil || 'N/A'}`);
      }
    }

    console.log('\n✅ Antigravity attestation completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error posting to Antigravity API:', error.message);
    
    // Write error to file for debugging
    const errorRecord = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      request: payload
    };
    
    try {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(errorRecord, null, 2));
      console.error(`   Error details written to ${OUTPUT_PATH}`);
    } catch (writeError) {
      console.error('   Could not write error details to file');
    }

    process.exit(1);
  }
}

/**
 * Make HTTP/HTTPS POST request
 */
function postRequest(url, data, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const payloadString = JSON.stringify(data);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(payloadString)
      }
    };

    const req = protocol.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const response = JSON.parse(body);
            resolve(response);
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${body}`));
          }
        } else {
          let errorMessage = `HTTP ${res.statusCode}`;
          try {
            const errorBody = JSON.parse(body);
            errorMessage += `: ${errorBody.error || errorBody.message || body}`;
          } catch (e) {
            errorMessage += `: ${body}`;
          }
          reject(new Error(errorMessage));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payloadString);
    req.end();
  });
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { postRequest };
