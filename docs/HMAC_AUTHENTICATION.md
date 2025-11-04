# HMAC Authentication Guide

## Overview

This application uses HMAC (Hash-based Message Authentication Code) signatures to secure external API calls from services like n8n, webhooks, and other automated systems.

## How It Works

1. **Signing**: External service generates HMAC-SHA256 signature of the request body
2. **Header**: Signature is sent in `X-HMAC-Signature` header
3. **Verification**: API verifies signature matches expected value using shared secret

## Configuration

Set the shared secret in your environment variables:

```bash
SHARED_HMAC_SECRET=your-secret-key-here
```

**Important**: Keep this secret secure and never commit it to version control.

## Protected Endpoints

The following endpoints require HMAC authentication:

- `POST /api/jobs/callback` - Job status updates from external services
- `POST /api/credits/deduct` - Credit deduction (optional HMAC)
- `POST /api/credits/spend` - Credit spending (optional HMAC)

## Usage Examples

### Node.js / TypeScript

```typescript
import crypto from 'crypto';

const payload = JSON.stringify({
  jobId: "job-123",
  status: "completed",
  resultUrl: "https://example.com/result.mp4"
});

const secret = process.env.SHARED_HMAC_SECRET;
const signature = crypto
  .createHmac('sha256', secret)
  .update(payload, 'utf8')
  .digest('hex');

const response = await fetch('https://your-domain.com/api/jobs/callback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-HMAC-Signature': signature
  },
  body: payload
});
```

### n8n Workflow

#### Option 1: Function Node + HTTP Request

1. **Function Node** (before HTTP Request):
```javascript
const crypto = require('crypto');
const body = JSON.stringify($input.item.json);
const secret = process.env.SHARED_HMAC_SECRET;
const signature = crypto.createHmac('sha256', secret)
  .update(body, 'utf8')
  .digest('hex');

return {
  json: {
    ...$input.item.json,
    _hmacSignature: signature,
    _requestBody: body
  }
};
```

2. **HTTP Request Node**:
   - URL: `https://your-domain.com/api/jobs/callback`
   - Method: `POST`
   - Headers:
     - `Content-Type`: `application/json`
     - `X-HMAC-Signature`: `{{ $json._hmacSignature }}`
   - Body: `{{ $json._requestBody }}`

#### Option 2: HTTP Request Node with Expression

1. **HTTP Request Node**:
   - URL: `https://your-domain.com/api/jobs/callback`
   - Method: `POST`
   - Body (JSON):
     ```json
     {
       "jobId": "{{ $json.jobId }}",
       "status": "{{ $json.status }}"
     }
     ```
   - Use Expression for Header:
     - In n8n, you'll need to use a Code node to generate the signature first

### Python

```python
import hmac
import hashlib
import json
import requests

payload = {
    "jobId": "job-123",
    "status": "completed"
}

secret = os.getenv('SHARED_HMAC_SECRET')
body = json.dumps(payload)

signature = hmac.new(
    secret.encode('utf-8'),
    body.encode('utf-8'),
    hashlib.sha256
).hexdigest()

headers = {
    'Content-Type': 'application/json',
    'X-HMAC-Signature': signature
}

response = requests.post(
    'https://your-domain.com/api/jobs/callback',
    headers=headers,
    data=body
)
```

### cURL

```bash
#!/bin/bash

PAYLOAD='{"jobId":"job-123","status":"completed"}'
SECRET="your-secret-key"

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -X POST https://your-domain.com/api/jobs/callback \
  -H "Content-Type: application/json" \
  -H "X-HMAC-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## Testing

### Manual Testing

1. Generate a signature using one of the methods above
2. Make a POST request with the signature header
3. Verify you receive a `200 OK` response (not `401 Unauthorized`)

## Security Best Practices

1. **Use Strong Secrets**: Generate a long, random secret key (minimum 32 characters)
2. **Rotate Regularly**: Change the secret periodically
3. **Use HTTPS**: Always use HTTPS in production
4. **Never Log Secrets**: Never log or expose the secret key
5. **Rate Limiting**: Consider adding rate limiting to protected endpoints

## Troubleshooting

### Common Errors

- **401 Unauthorized**: Invalid signature
  - Check that the secret matches on both sides
  - Verify the payload is signed correctly (raw body, not parsed)
  - Ensure the signature header name is `X-HMAC-Signature` (case-sensitive)

- **Missing Header**: Signature header not found
  - Ensure the header `X-HMAC-Signature` is included in the request

### Debug Tips

1. Log the received signature and expected signature (in development only)
2. Verify the payload is exactly the same on both sides
3. Check for whitespace or encoding differences
4. Ensure timing-safe comparison is used (already implemented)

## Code Reference

- HMAC Middleware: `lib/middleware/hmac.ts`
- Client Utilities: `lib/utils/hmac-client.ts`
- Example Usage: `app/api/jobs/callback/route.ts`

