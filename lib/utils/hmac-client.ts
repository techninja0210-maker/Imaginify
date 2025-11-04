import crypto from "crypto";

/**
 * HMAC Client Utility
 * 
 * Helper functions for generating HMAC signatures in external services (n8n, webhooks, etc.)
 * 
 * Example usage in n8n:
 * 1. Set environment variable: SHARED_HMAC_SECRET=your-secret-key
 * 2. Use HMAC node with SHA256 algorithm
 * 3. Sign the raw request body
 * 4. Add header: X-HMAC-Signature: {{hmac-signature}}
 */

/**
 * Generate HMAC signature for a payload
 * @param payload - Request body (string or object - will be JSON stringified if object)
 * @param secret - HMAC secret key
 * @returns HMAC signature as hex string
 */
export function signPayload(payload: string | object, secret: string): string {
  const payloadString = typeof payload === "string" 
    ? payload 
    : JSON.stringify(payload);
  
  return crypto
    .createHmac("sha256", secret)
    .update(payloadString, "utf8")
    .digest("hex");
}

/**
 * Create signed request headers
 * @param payload - Request body
 * @param secret - HMAC secret key
 * @returns Headers object with X-HMAC-Signature
 */
export function createSignedHeaders(
  payload: string | object,
  secret: string
): { "X-HMAC-Signature": string } {
  const signature = signPayload(payload, secret);
  return {
    "X-HMAC-Signature": signature,
  };
}

/**
 * Example: How to call a protected API endpoint
 * 
 * ```typescript
 * const payload = { jobId: "123", status: "completed" };
 * const secret = process.env.SHARED_HMAC_SECRET!;
 * const headers = createSignedHeaders(payload, secret);
 * 
 * const response = await fetch("https://your-api.com/api/jobs/callback", {
 *   method: "POST",
 *   headers: {
 *     "Content-Type": "application/json",
 *     ...headers,
 *   },
 *   body: JSON.stringify(payload),
 * });
 * ```
 */

/**
 * Example for n8n HTTP Request Node:
 * 
 * 1. Method: POST
 * 2. URL: https://your-domain.com/api/jobs/callback
 * 3. Headers:
 *    - Content-Type: application/json
 *    - X-HMAC-Signature: {{ $signPayload($json.body) }}
 * 
 * 4. Body (JSON):
 *    {
 *      "jobId": "{{ $json.jobId }}",
 *      "status": "completed",
 *      "resultUrl": "https://example.com/result.mp4"
 *    }
 * 
 * 5. In n8n, use a Function node before HTTP Request:
 *    const crypto = require('crypto');
 *    const body = JSON.stringify($input.item.json);
 *    const secret = process.env.SHARED_HMAC_SECRET;
 *    const signature = crypto.createHmac('sha256', secret)
 *      .update(body, 'utf8')
 *      .digest('hex');
 *    
 *    return {
 *      json: {
 *        ...$input.item.json,
 *        hmacSignature: signature
 *      }
 *    };
 * 
 * 6. In HTTP Request headers:
 *    X-HMAC-Signature: {{ $json.hmacSignature }}
 */

