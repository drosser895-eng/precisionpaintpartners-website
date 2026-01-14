# Antigravity Attestation Integration

## Overview

The Antigravity attestation service provides third-party verification and cryptographic attestation of score anchoring events. This document describes how to integrate the Antigravity adapter into your audit pipeline.

## What is Antigravity?

Antigravity is a third-party attestation service that:
- Provides independent verification of data integrity
- Issues cryptographically signed attestation certificates
- Maintains an immutable audit log
- Offers API-based integration for automated workflows

## Integration Architecture

```
generate_proofs.js → proofs.json
                         ↓
anchor (on-chain)    anchor_mapping.json
                         ↓
antigravity_adapter.js → POST to Antigravity API
                         ↓
                  antigravity_attestation.json
```

## Setup

### Prerequisites
- Node.js 14.x or higher
- Antigravity API account and credentials
- Valid anchor mapping (blockchain anchoring completed)

### Environment Variables

Add to your `.env` file:

```bash
# Antigravity Configuration
ANTIGRAVITY_URL=https://api.antigravity.example.com/v1/attest
ANTIGRAVITY_API_KEY=your_api_key_here

# Optional: Enable HMAC signing for enhanced security
ANTIGRAVITY_HMAC_SECRET=your_hmac_secret_here
```

### Install Dependencies

The `antigravity_adapter.js` script requires:

```bash
npm install axios
# HMAC signing is built into Node.js crypto module (no additional install needed)
```

## Usage

### Manual Execution

After completing blockchain anchoring:

```bash
# Run the Antigravity adapter
node antigravity_adapter.js

# Expected output:
# ✓ Reading anchor mapping from ./scores/anchor_mapping.json
# ✓ Preparing attestation payload
# ✓ Posting to Antigravity API
# ✓ Attestation received
# ✓ Written to ./scores/antigravity_attestation.json
```

### Automated Execution (CI/CD)

The adapter is integrated into the CI workflow (`.github/workflows/ci.yml`):

```yaml
- name: Request Antigravity Attestation (Optional)
  if: github.event.inputs.attest == 'true'
  env:
    ANTIGRAVITY_URL: ${{ secrets.ANTIGRAVITY_URL }}
    ANTIGRAVITY_API_KEY: ${{ secrets.ANTIGRAVITY_API_KEY }}
  run: node antigravity_adapter.js
```

Trigger with workflow dispatch and set `attest` input to `true`.

## API Request Format

The adapter sends a POST request with the following payload:

```json
{
  "merkleRoot": "0xabc123...",
  "txHash": "0xdef456...",
  "blockNumber": 12345678,
  "timestamp": "2026-01-14T12:00:00Z",
  "contractAddress": "0x789abc...",
  "metadata": {
    "repository": "drosser895-eng/precisionpaintpartners-website",
    "scoreCount": 150,
    "engineVersion": "1.0.0"
  }
}
```

### Request Headers

```
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
X-HMAC-Signature: <signature> (if HMAC enabled)
```

### HMAC Signature Calculation

When `ANTIGRAVITY_HMAC_SECRET` is set, the adapter computes:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', process.env.ANTIGRAVITY_HMAC_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');
```

## API Response Format

Successful attestation response:

```json
{
  "success": true,
  "attestationId": "att_xyz789",
  "timestamp": "2026-01-14T12:00:05Z",
  "signature": "0x1234567890abcdef...",
  "certificate": {
    "issuer": "Antigravity Attestation Service",
    "subject": "MerkleRoot 0xabc123...",
    "validFrom": "2026-01-14T12:00:05Z",
    "validUntil": "2027-01-14T12:00:05Z"
  },
  "verificationUrl": "https://verify.antigravity.example.com/att_xyz789"
}
```

Error response:

```json
{
  "success": false,
  "error": "Invalid API key",
  "code": "AUTH_FAILED"
}
```

## Sample Payloads

### Minimal Payload

```json
{
  "merkleRoot": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  "txHash": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "blockNumber": 16500000,
  "timestamp": "2026-01-14T10:30:00Z",
  "contractAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
}
```

### Full Payload with Metadata

```json
{
  "merkleRoot": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  "txHash": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "blockNumber": 16500000,
  "timestamp": "2026-01-14T10:30:00Z",
  "contractAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "metadata": {
    "repository": "drosser895-eng/precisionpaintpartners-website",
    "commitHash": "abc123def456",
    "scoreCount": 250,
    "engineVersion": "1.0.0",
    "networkName": "mainnet",
    "gasUsed": 85432,
    "deployer": "0x9876543210abcdef9876543210abcdef98765432"
  }
}
```

## Verification

### Verify Attestation

After receiving attestation, verify it:

```bash
# Visit the verification URL from the response
open https://verify.antigravity.example.com/att_xyz789

# Or use the API
curl -H "Authorization: Bearer $ANTIGRAVITY_API_KEY" \
  https://api.antigravity.example.com/v1/verify/att_xyz789
```

### Verify Signature

The attestation includes a cryptographic signature that can be verified:

```javascript
const crypto = require('crypto');
const { publicKey, signature, data } = attestation;

const verify = crypto.createVerify('SHA256');
verify.update(JSON.stringify(data));
const isValid = verify.verify(publicKey, signature, 'hex');
console.log('Signature valid:', isValid);
```

## Output Artifact

The adapter writes `./scores/antigravity_attestation.json`:

```json
{
  "attestationId": "att_xyz789",
  "timestamp": "2026-01-14T12:00:05Z",
  "merkleRoot": "0xabc123...",
  "signature": "0x1234567890abcdef...",
  "certificate": {
    "issuer": "Antigravity Attestation Service",
    "subject": "MerkleRoot 0xabc123...",
    "validFrom": "2026-01-14T12:00:05Z",
    "validUntil": "2027-01-14T12:00:05Z"
  },
  "verificationUrl": "https://verify.antigravity.example.com/att_xyz789",
  "request": {
    "merkleRoot": "0xabc123...",
    "txHash": "0xdef456...",
    "blockNumber": 12345678,
    "timestamp": "2026-01-14T12:00:00Z"
  }
}
```

This artifact should be included in your evidence package for regulators.

## Error Handling

The adapter handles common errors:

| Error | Cause | Resolution |
|-------|-------|------------|
| `ENOENT: anchor_mapping.json not found` | Anchoring not completed | Run anchoring first |
| `401 Unauthorized` | Invalid API key | Check `ANTIGRAVITY_API_KEY` |
| `400 Bad Request` | Invalid payload format | Verify anchor_mapping.json schema |
| `429 Too Many Requests` | Rate limit exceeded | Wait and retry |
| `500 Internal Server Error` | Antigravity service issue | Check service status |

## Security Considerations

### API Key Protection
- **Never commit** `ANTIGRAVITY_API_KEY` to repository
- Store in GitHub Secrets or environment variables
- Rotate keys periodically
- Use separate keys for dev/prod environments

### HMAC Signing
- Enable HMAC for production use
- Protects against request tampering
- Provides additional authentication layer
- Secret should be different from API key

### Network Security
- Use HTTPS endpoints only
- Validate SSL certificates
- Consider IP allowlisting if available
- Monitor for unusual API activity

## Cost & Rate Limits

| Plan | Rate Limit | Monthly Quota | Notes |
|------|-----------|---------------|-------|
| Free | 10/hour | 100 attestations | Development only |
| Pro | 100/hour | 5,000 attestations | Production use |
| Enterprise | Custom | Unlimited | SLA included |

Contact Antigravity sales for enterprise plans.

## Support

### Antigravity Support
- **Documentation**: https://docs.antigravity.example.com
- **API Status**: https://status.antigravity.example.com
- **Support Email**: support@antigravity.example.com
- **Community**: https://community.antigravity.example.com

### Integration Issues
- Check adapter logs for detailed error messages
- Verify environment variables are set correctly
- Test with sample payload (see above)
- Review API documentation for updates

---

**Integration Version**: 1.0  
**Last Updated**: 2026-01-14  
**Compatible with**: Antigravity API v1
