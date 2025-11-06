# External Credit Deduction API

## Overview

This API allows external developers to deduct credits from user accounts when content is created. It uses HMAC authentication for security and supports idempotency to prevent duplicate charges.

## Endpoint

```
POST /api/credits/deduct-external
```

## Authentication

All requests must include an HMAC signature in the `X-HMAC-Signature` header.

### HMAC Signature Generation

1. Create a JSON payload with your request body
2. Generate HMAC-SHA256 signature using `SHARED_HMAC_SECRET`
3. Send signature as hex string in `X-HMAC-Signature` header

## Request Body

```json
{
  "userEmail": "user@example.com",  // Optional: user email address
  "userId": "user_xxx",              // Optional: Clerk user ID
  "amount": 10,                       // Required: credits to deduct (must be positive)
  "reason": "Content creation",      // Optional: reason for deduction
  "idempotencyKey": "unique-key-123" // Optional: prevents duplicate charges
}
```

**Note:** Either `userEmail` OR `userId` must be provided (not both).

## Response

### Success Response (200)

```json
{
  "success": true,
  "newBalance": 90,
  "deducted": 10,
  "ledgerId": "clxxxxx",
  "userId": "user_xxx",
  "email": "user@example.com",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Responses

#### 401 Unauthorized - Invalid HMAC Signature
```json
{
  "error": "Invalid HMAC signature",
  "code": "HMAC_VALIDATION_FAILED"
}
```

#### 400 Bad Request - Missing User Identifier
```json
{
  "error": "Either userEmail or userId must be provided",
  "code": "MISSING_USER_IDENTIFIER"
}
```

#### 400 Bad Request - Invalid Amount
```json
{
  "error": "Amount must be a positive number",
  "code": "INVALID_AMOUNT"
}
```

#### 402 Payment Required - Insufficient Credits
```json
{
  "error": "Insufficient credits. Current: 5, Required: 10",
  "code": "INSUFFICIENT_CREDITS"
}
```

#### 404 Not Found - User Not Found
```json
{
  "error": "User not found with email: user@example.com",
  "code": "USER_NOT_FOUND"
}
```

#### 409 Conflict - Duplicate Transaction
```json
{
  "error": "Transaction already processed",
  "code": "DUPLICATE_TRANSACTION",
  "ledgerId": "clxxxxx"
}
```

## Code Examples

### Node.js / TypeScript

```typescript
import crypto from 'crypto';

const API_URL = 'https://your-domain.com/api/credits/deduct-external';
const HMAC_SECRET = process.env.SHARED_HMAC_SECRET;

async function deductCredits(userEmail: string, amount: number, reason?: string) {
  const payload = {
    userEmail,
    amount,
    reason: reason || 'Content creation',
    idempotencyKey: `content-${Date.now()}-${Math.random()}`
  };

  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(body, 'utf8')
    .digest('hex');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HMAC-Signature': signature
    },
    body
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to deduct credits');
  }

  return result;
}

// Usage
try {
  const result = await deductCredits('user@example.com', 10, 'Video generation');
  console.log(`Deducted ${result.deducted} credits. New balance: ${result.newBalance}`);
} catch (error) {
  console.error('Error:', error.message);
}
```

### Python

```python
import hmac
import hashlib
import json
import requests
import os

API_URL = 'https://your-domain.com/api/credits/deduct-external'
HMAC_SECRET = os.getenv('SHARED_HMAC_SECRET')

def deduct_credits(user_email: str, amount: int, reason: str = 'Content creation'):
    payload = {
        'userEmail': user_email,
        'amount': amount,
        'reason': reason,
        'idempotencyKey': f'content-{int(time.time())}-{random.random()}'
    }
    
    body = json.dumps(payload)
    signature = hmac.new(
        HMAC_SECRET.encode('utf-8'),
        body.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    headers = {
        'Content-Type': 'application/json',
        'X-HMAC-Signature': signature
    }
    
    response = requests.post(API_URL, headers=headers, data=body)
    result = response.json()
    
    if not response.ok:
        raise Exception(result.get('error', 'Failed to deduct credits'))
    
    return result

# Usage
try:
    result = deduct_credits('user@example.com', 10, 'Video generation')
    print(f"Deducted {result['deducted']} credits. New balance: {result['newBalance']}")
except Exception as e:
    print(f'Error: {e}')
```

### cURL

```bash
#!/bin/bash

API_URL="https://your-domain.com/api/credits/deduct-external"
HMAC_SECRET="your-secret-key"

PAYLOAD='{"userEmail":"user@example.com","amount":10,"reason":"Content creation","idempotencyKey":"unique-key-123"}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$HMAC_SECRET" | sed 's/^.* //')

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## Idempotency

To prevent duplicate charges when retrying failed requests, include a unique `idempotencyKey` in your request. If the same key is used twice, the second request will return the existing transaction result without deducting credits again.

**Best Practice:** Generate a unique key per content creation attempt (e.g., `content-{contentId}-{timestamp}`).

## Error Handling

1. **Insufficient Credits (402)**: User doesn't have enough credits. Check balance before attempting deduction.
2. **Duplicate Transaction (409)**: Idempotency key already used. Transaction was already processed.
3. **User Not Found (404)**: User email or ID doesn't exist in the system.
4. **HMAC Validation Failed (401)**: Check that your secret matches and signature is correctly generated.

## Best Practices

1. **Always use idempotency keys** when creating content to prevent duplicate charges
2. **Check balance first** if possible to avoid unnecessary API calls
3. **Handle 402 errors gracefully** - notify user to purchase more credits
4. **Log all transactions** on your side for reconciliation
5. **Use HTTPS** in production (required for security)
6. **Implement retry logic** with exponential backoff for transient errors

## Rate Limiting

Currently no rate limiting is enforced, but please:
- Batch requests when possible
- Avoid excessive polling
- Implement reasonable retry delays (minimum 1 second)

## Support

For issues or questions, contact the development team or refer to the main project documentation.

