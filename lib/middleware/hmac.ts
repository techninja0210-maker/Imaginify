import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * HMAC Verification Utility
 *
 * Verifies HMAC signatures for secure external API calls (e.g., from n8n, webhooks)
 *
 * Usage:
 * - Generate signature: HMAC-SHA256(secret, canonicalMessage)
 * - Canonical message format: `${method}\n${path}\n${timestamp}\n${body}`
 * - Required headers:
 *   - X-HMAC-Signature
 *   - X-Client-Id
 *   - X-Timestamp (ISO8601)
 *   - X-Idempotency-Key
 *   - X-Key-Id (optional for key rotation)
 *   - X-Env (optional; defaults to production)
 */

const HMAC_HEADER = "x-hmac-signature";
const KEY_ID_HEADER = "x-key-id";
const CLIENT_ID_HEADER = "x-client-id";
const TIMESTAMP_HEADER = "x-timestamp";
const IDEMPOTENCY_HEADER = "x-idempotency-key";
const ENV_HEADER = "x-env";

const HMAC_SECRET_ENV = "SHARED_HMAC_SECRET";
const ALLOWED_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export type ValidatedHMACHeaders = {
  clientId: string | null;
  timestamp: string | null;
  idempotencyKey: string | null;
  keyId: string | null;
  environment: "production" | "sandbox";
};

function sanitizeKeyId(keyId?: string | null): string | null {
  if (!keyId) return null;
  return keyId.replace(/[^A-Za-z0-9_]/g, "").toUpperCase();
}

function getSecretForKeyId(keyId?: string | null): string | null {
  const sanitized = sanitizeKeyId(keyId);

  if (sanitized) {
    const envKey = `SHARED_HMAC_SECRET_${sanitized}`;
    if (process.env[envKey]) {
      return process.env[envKey] || null;
    }
  }

  return process.env[HMAC_SECRET_ENV] || null;
}

function buildCanonicalMessage(
  method: string,
  path: string,
  timestamp: string,
  body: string
): string {
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
}

/**
 * Verify HMAC signature
 * @param canonicalMessage - Canonical message to sign
 * @param signature - HMAC signature from header
 * @param secret - HMAC secret (defaults to SHARED_HMAC_SECRET env var)
 * @returns true if signature is valid
 */
export function verifyHMAC(
  canonicalMessage: string,
  signature: string | null,
  secret?: string | null
): boolean {
  const hmacSecret = secret || process.env[HMAC_SECRET_ENV];

  if (!hmacSecret || !signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", hmacSecret)
      .update(canonicalMessage, "utf8")
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    console.error("HMAC verification error:", error);
    return false;
  }
}

/**
 * Generate HMAC signature for outbound requests
 * @param message - Canonical message string
 * @param secret - HMAC secret (defaults to SHARED_HMAC_SECRET env var)
 * @returns HMAC signature as hex string
 */
export function generateHMAC(
  message: string,
  secret?: string
): string {
  const hmacSecret = secret || process.env[HMAC_SECRET_ENV];

  if (!hmacSecret) {
    throw new Error("HMAC secret not configured");
  }

  return crypto
    .createHmac("sha256", hmacSecret)
    .update(message, "utf8")
    .digest("hex");
}

type ValidationResult = {
  valid: boolean;
  error?: string;
  code?: string;
  body?: any;
  rawBody?: string;
  headers?: ValidatedHMACHeaders;
};

/**
 * HMAC Middleware - Validates HMAC signature on incoming requests
 *
 * Usage in API route:
 *
 * export async function POST(req: NextRequest) {
 *   const validation = await validateHMACRequest(req);
 *   if (!validation.valid) {
 *     return NextResponse.json({ error: validation.error }, { status: 401 });
 *   }
 *
 *   const body = validation.body; // Already parsed JSON
 *   // ... rest of your handler
 * }
 */
export async function validateHMACRequest(
  req: NextRequest
): Promise<ValidationResult> {
  try {
    const rawBody = await req.text();

    const signature = req.headers.get(HMAC_HEADER);
    const keyId = req.headers.get(KEY_ID_HEADER);
    const clientId = req.headers.get(CLIENT_ID_HEADER);
    const timestamp = req.headers.get(TIMESTAMP_HEADER);
    const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER);
    const environmentHeader = req.headers.get(ENV_HEADER);
    const environment = environmentHeader?.toLowerCase() === "sandbox" ? "sandbox" : "production";

    if (!signature) {
      return {
        valid: false,
        error: "Missing HMAC signature header",
        code: "HMAC_SIGNATURE_MISSING",
        headers: { clientId, timestamp, idempotencyKey, keyId, environment },
      };
    }

    if (!clientId) {
      return {
        valid: false,
        error: "Missing client identifier header",
        code: "CLIENT_ID_MISSING",
        headers: { clientId, timestamp, idempotencyKey, keyId, environment },
      };
    }

    if (!timestamp) {
      return {
        valid: false,
        error: "Missing timestamp header",
        code: "TIMESTAMP_MISSING",
        headers: { clientId, timestamp, idempotencyKey, keyId, environment },
      };
    }

    const timestampDate = new Date(timestamp);
    if (Number.isNaN(timestampDate.getTime())) {
      return {
        valid: false,
        error: "Invalid timestamp format",
        code: "TIMESTAMP_INVALID",
        headers: { clientId, timestamp, idempotencyKey, keyId, environment },
      };
    }

    const now = Date.now();
    const requestTime = timestampDate.getTime();
    if (Math.abs(now - requestTime) > ALLOWED_TIMESTAMP_SKEW_MS) {
      return {
        valid: false,
        error: "Request timestamp outside allowed window",
        code: "TIMESTAMP_SKEW",
        headers: { clientId, timestamp, idempotencyKey, keyId, environment },
      };
    }

    const canonicalMessage = buildCanonicalMessage(
      req.method,
      req.nextUrl.pathname,
      timestamp,
      rawBody
    );

    const secret = getSecretForKeyId(keyId);

    if (!verifyHMAC(canonicalMessage, signature, secret)) {
      return {
        valid: false,
        error: "Invalid HMAC signature",
        code: "HMAC_VALIDATION_FAILED",
        headers: { clientId, timestamp, idempotencyKey, keyId, environment },
      };
    }

    // Parse JSON body if present
    let body: any = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        body = rawBody;
      }
    }

    return {
      valid: true,
      body,
      rawBody,
      headers: { clientId, timestamp, idempotencyKey, keyId, environment },
    };
  } catch (error) {
    console.error("HMAC validation error:", error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "HMAC validation failed",
      code: "HMAC_VALIDATION_FAILED",
    };
  }
}

/**
 * HMAC Middleware Wrapper - Higher-order function for API routes
 */
export function withHMAC(
  handler: (
    req: NextRequest,
    body: any,
    rawBody: string,
    headers: ValidatedHMACHeaders
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const validation = await validateHMACRequest(req);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error || "HMAC validation failed",
          code: validation.code || "HMAC_VALIDATION_FAILED",
        },
        { status: 401 }
      );
    }

    return handler(
      req,
      validation.body,
      validation.rawBody || "",
      (validation.headers || {
        clientId: null,
        timestamp: null,
        idempotencyKey: null,
        keyId: null,
        environment: "production",
      }) as ValidatedHMACHeaders
    );
  };
}

/**
 * Optional HMAC Middleware - Only validates if signature is provided
 */
export function withOptionalHMAC(
  handler: (
    req: NextRequest,
    body: any,
    rawBody: string,
    isVerified: boolean,
    headers: ValidatedHMACHeaders
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const signature = req.headers.get(HMAC_HEADER);
    const keyId = req.headers.get(KEY_ID_HEADER);
    const clientId = req.headers.get(CLIENT_ID_HEADER);
    const timestamp = req.headers.get(TIMESTAMP_HEADER);
    const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER);
    const environmentHeader = req.headers.get(ENV_HEADER);
    const environment = environmentHeader?.toLowerCase() === "sandbox" ? "sandbox" : "production";

    const rawBody = await req.text();

    let isVerified = false;
    let body: any = null;
    let headers: ValidatedHMACHeaders = {
      clientId,
      timestamp,
      idempotencyKey,
      keyId,
      environment,
    };

    if (signature) {
      if (!timestamp) {
        return NextResponse.json(
          { error: "Missing timestamp header", code: "TIMESTAMP_MISSING" },
          { status: 401 }
        );
      }

      const canonicalMessage = buildCanonicalMessage(
        req.method,
        req.nextUrl.pathname,
        timestamp,
        rawBody
      );

      isVerified = verifyHMAC(canonicalMessage, signature, getSecretForKeyId(keyId));
      if (!isVerified) {
        return NextResponse.json(
          { error: "Invalid HMAC signature", code: "HMAC_VALIDATION_FAILED" },
          { status: 401 }
        );
      }
    }

    // Parse body
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        body = rawBody;
      }
    }

    return handler(req, body, rawBody, isVerified, headers);
  };
}

