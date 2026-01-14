#!/usr/bin/env node

/**
 * Monitoring & Alerts Script
 * 
 * Checks ./scores/anchor_mapping.json and posts alerts to SLACK_WEBHOOK_URL
 * when issues are detected. Used by anchor-monitor workflow.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const ANCHOR_MAPPING_PATH = path.join(__dirname, 'scores', 'anchor_mapping.json');
const PROOFS_PATH = path.join(__dirname, 'scores', 'proofs.json');

// Alert thresholds
const MAX_AGE_HOURS = 72; // Alert if anchor is older than 72 hours
const MIN_SCORE_COUNT = 1; // Alert if fewer than 1 score

/**
 * Main monitoring function
 */
async function main() {
  console.log('🔍 Anchor Monitoring & Alerts');
  console.log('===============================\n');

  const issues = [];
  const warnings = [];
  const info = [];

  // Check if anchor mapping exists
  if (!fs.existsSync(ANCHOR_MAPPING_PATH)) {
    issues.push({
      severity: 'error',
      message: 'Anchor mapping file not found',
      details: `Expected at: ${ANCHOR_MAPPING_PATH}`,
      action: 'Run blockchain anchoring process'
    });
  } else {
    // Read and validate anchor mapping
    try {
      const anchorData = fs.readFileSync(ANCHOR_MAPPING_PATH, 'utf8');
      const anchorMapping = JSON.parse(anchorData);
      
      console.log('✓ Anchor mapping file found\n');
      console.log('📊 Anchor Details:');
      console.log(`   Merkle Root: ${anchorMapping.merkleRoot || 'N/A'}`);
      console.log(`   TX Hash: ${anchorMapping.txHash || 'N/A'}`);
      console.log(`   Block Number: ${anchorMapping.blockNumber || 'N/A'}`);
      console.log(`   Timestamp: ${anchorMapping.timestamp || 'N/A'}`);
      console.log(`   Contract: ${anchorMapping.contractAddress || 'N/A'}\n`);

      // Validate required fields
      const requiredFields = ['merkleRoot', 'txHash', 'blockNumber', 'timestamp', 'contractAddress'];
      const missingFields = requiredFields.filter(field => !anchorMapping[field]);
      
      if (missingFields.length > 0) {
        issues.push({
          severity: 'error',
          message: 'Anchor mapping missing required fields',
          details: `Missing: ${missingFields.join(', ')}`,
          action: 'Regenerate anchor mapping with complete data'
        });
      }

      // Check timestamp age
      if (anchorMapping.timestamp) {
        const anchorTime = new Date(anchorMapping.timestamp);
        const now = new Date();
        const ageHours = (now - anchorTime) / (1000 * 60 * 60);
        
        if (ageHours > MAX_AGE_HOURS) {
          warnings.push({
            severity: 'warning',
            message: `Anchor is ${Math.floor(ageHours)} hours old`,
            details: `Timestamp: ${anchorMapping.timestamp}`,
            action: 'Consider re-anchoring with fresh data'
          });
        } else {
          info.push(`Anchor age: ${Math.floor(ageHours)} hours (within acceptable range)`);
        }
      }

      // Check score count
      if (anchorMapping.scoreCount !== undefined) {
        if (anchorMapping.scoreCount < MIN_SCORE_COUNT) {
          warnings.push({
            severity: 'warning',
            message: `Low score count: ${anchorMapping.scoreCount}`,
            details: `Minimum expected: ${MIN_SCORE_COUNT}`,
            action: 'Verify score generation is working correctly'
          });
        } else {
          info.push(`Score count: ${anchorMapping.scoreCount}`);
        }
      }

      // Validate merkleRoot format
      if (anchorMapping.merkleRoot && !anchorMapping.merkleRoot.startsWith('0x')) {
        issues.push({
          severity: 'error',
          message: 'Invalid merkleRoot format',
          details: `Expected hex string starting with 0x, got: ${anchorMapping.merkleRoot.substring(0, 20)}...`,
          action: 'Regenerate proofs with correct format'
        });
      }

      // Validate txHash format
      if (anchorMapping.txHash && !anchorMapping.txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        warnings.push({
          severity: 'warning',
          message: 'Transaction hash format may be invalid',
          details: `Expected 66-character hex string, got: ${anchorMapping.txHash}`,
          action: 'Verify transaction on block explorer'
        });
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        message: 'Failed to read or parse anchor mapping',
        details: error.message,
        action: 'Check file format and permissions'
      });
    }
  }

  // Check if proofs file exists
  if (!fs.existsSync(PROOFS_PATH)) {
    warnings.push({
      severity: 'warning',
      message: 'Proofs file not found',
      details: `Expected at: ${PROOFS_PATH}`,
      action: 'Run generate_proofs.js to create proofs'
    });
  } else {
    try {
      const proofsData = fs.readFileSync(PROOFS_PATH, 'utf8');
      const proofs = JSON.parse(proofsData);
      
      console.log('✓ Proofs file found');
      console.log(`   Total scores with proofs: ${Object.keys(proofs.proofs || {}).length}\n`);

      // Cross-validate merkleRoot
      if (fs.existsSync(ANCHOR_MAPPING_PATH)) {
        const anchorData = JSON.parse(fs.readFileSync(ANCHOR_MAPPING_PATH, 'utf8'));
        if (anchorData.merkleRoot !== proofs.merkleRoot) {
          issues.push({
            severity: 'error',
            message: 'Merkle root mismatch between proofs and anchor mapping',
            details: `Proofs: ${proofs.merkleRoot}\nAnchor: ${anchorData.merkleRoot}`,
            action: 'Regenerate proofs or re-anchor to ensure consistency'
          });
        }
      }

    } catch (error) {
      warnings.push({
        severity: 'warning',
        message: 'Failed to read or parse proofs file',
        details: error.message,
        action: 'Regenerate proofs.json'
      });
    }
  }

  // Print summary
  console.log('═══════════════════════════════\n');
  console.log('📋 Monitoring Summary:');
  console.log(`   Errors: ${issues.length}`);
  console.log(`   Warnings: ${warnings.length}`);
  console.log(`   Info: ${info.length}\n`);

  // Display issues
  if (issues.length > 0) {
    console.log('❌ ERRORS:');
    issues.forEach((issue, idx) => {
      console.log(`   ${idx + 1}. ${issue.message}`);
      console.log(`      ${issue.details}`);
      console.log(`      ➜ ${issue.action}\n`);
    });
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach((warning, idx) => {
      console.log(`   ${idx + 1}. ${warning.message}`);
      console.log(`      ${warning.details}`);
      console.log(`      ➜ ${warning.action}\n`);
    });
  }

  // Display info
  if (info.length > 0) {
    console.log('ℹ️  INFO:');
    info.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. ${msg}`);
    });
    console.log();
  }

  // Send alerts to Slack if configured and there are issues/warnings
  if (SLACK_WEBHOOK_URL && (issues.length > 0 || warnings.length > 0)) {
    console.log('📤 Sending alerts to Slack...\n');
    
    try {
      await sendSlackAlert(issues, warnings, info);
      console.log('✓ Slack notification sent successfully\n');
    } catch (error) {
      console.error('❌ Failed to send Slack notification:', error.message);
    }
  } else if (!SLACK_WEBHOOK_URL) {
    console.log('ℹ️  Slack webhook not configured (set SLACK_WEBHOOK_URL to enable notifications)\n');
  } else {
    console.log('✅ No issues to report. System healthy!\n');
  }

  // Exit with appropriate code
  if (issues.length > 0) {
    console.log('🔴 Monitoring completed with ERRORS\n');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('🟡 Monitoring completed with WARNINGS\n');
    process.exit(0); // Don't fail on warnings
  } else {
    console.log('🟢 Monitoring completed successfully\n');
    process.exit(0);
  }
}

/**
 * Send alert to Slack webhook
 */
async function sendSlackAlert(issues, warnings, info) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🚨 Anchor Monitoring Alert',
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Repository:* drosser895-eng/precisionpaintpartners-website\n*Timestamp:* ${new Date().toISOString()}`
      }
    },
    {
      type: 'divider'
    }
  ];

  // Add errors
  if (issues.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*❌ Errors (${issues.length}):*`
      }
    });

    issues.forEach(issue => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *${issue.message}*\n  ${issue.details}\n  ➜ _${issue.action}_`
        }
      });
    });
  }

  // Add warnings
  if (warnings.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⚠️  Warnings (${warnings.length}):*`
      }
    });

    warnings.forEach(warning => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *${warning.message}*\n  ${warning.details}\n  ➜ _${warning.action}_`
        }
      });
    });
  }

  const payload = {
    blocks: blocks,
    text: `Anchor monitoring alert: ${issues.length} errors, ${warnings.length} warnings`
  };

  return postToSlack(SLACK_WEBHOOK_URL, payload);
}

/**
 * POST to Slack webhook
 */
function postToSlack(url, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const payloadString = JSON.stringify(payload);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString)
      }
    };

    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`Slack webhook returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payloadString);
    req.end();
  });
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { sendSlackAlert };
