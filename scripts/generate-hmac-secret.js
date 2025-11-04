/**
 * Generate HMAC Secret Key
 * 
 * This script generates a secure random HMAC secret key for use with SHARED_HMAC_SECRET
 * 
 * Usage:
 *   node scripts/generate-hmac-secret.js
 * 
 * Or run with length parameter:
 *   node scripts/generate-hmac-secret.js 64
 */

const crypto = require('crypto');

// Get desired length from command line or default to 32
const length = process.argv[2] ? parseInt(process.argv[2]) : 32;

if (isNaN(length) || length < 16) {
  console.error('❌ Error: Length must be a number >= 16');
  process.exit(1);
}

// Generate random secret
const secret = crypto.randomBytes(length).toString('hex');

console.log('\n🔐 HMAC Secret Key Generated\n');
console.log('='.repeat(50));
console.log(secret);
console.log('='.repeat(50));
console.log('\n📝 Add this to your .env.local file:\n');
console.log(`SHARED_HMAC_SECRET=${secret}`);
console.log('\n⚠️  Important:');
console.log('   - Keep this secret secure');
console.log('   - Never commit it to version control');
console.log('   - Share it securely with external services (n8n, etc.)');
console.log('   - Use the same secret on both sides (API and external service)\n');

