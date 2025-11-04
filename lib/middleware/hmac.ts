import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * HMAC Verification Utility
 * 
 * Verifies HMAC signatures for secure external API calls (e.g., from n8n, webhooks)
 * 
 * Usage:
 * - Generate signature: HMAC-SHA256(payload, secret)
 * - Send in header: X-HMAC-Signature
 * - Verify using this middleware
 */

const HMAC_HEADER = "x-hmac-signature";
const HMAC_SECRET_ENV = "SHARED_HMAC_SECRET";

/**
 * Verify HMAC signature
 * @param payload - Raw request body as string
 * @param signature - HMAC signature from header
 * @param secret - HMAC secret (defaults to SHARED_HMAC_SECRET env var)
 * @returns true if signature is valid
 */
export function verifyHMAC(
  payload: string,
  signature: string | null,
  secret?: string
): boolean {
  const hmacSecret = secret || process.env[HMAC_SECRET_ENV];
  
  if (!hmacSecret || !signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", hmacSecret)
      .update(payload, "utf8")
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
 * @param payload - Request body as string
 * @param secret - HMAC secret (defaults to SHARED_HMAC_SECRET env var)
 * @returns HMAC signature as hex string
 */
export function generateHMAC(
  payload: string,
  secret?: string
): string {
  const hmacSecret = secret || process.env[HMAC_SECRET_ENV];
  
  if (!hmacSecret) {
    throw new Error("HMAC secret not configured");
  }

  return crypto
    .createHmac("sha256", hmacSecret)
    .update(payload, "utf8")
    .digest("hex");
}

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
): Promise<{
  valid: boolean;
  error?: string;
  body?: any;
  rawBody?: string;
}> {
  try {
    // Get raw body for HMAC verification
    const rawBody = await req.text();
    
    // Get signature from header
    const signature = req.headers.get(HMAC_HEADER);

    if (!signature) {
      return {
        valid: false,
        error: "Missing HMAC signature header",
      };
    }

    // Verify HMAC
    if (!verifyHMAC(rawBody, signature)) {
      return {
        valid: false,
        error: "Invalid HMAC signature",
      };
    }

    // Parse JSON body if present
    let body: any = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        // Not JSON, that's okay - raw body is still available
        body = rawBody;
      }
    }

    return {
      valid: true,
      body,
      rawBody,
    };
  } catch (error) {
    console.error("HMAC validation error:", error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "HMAC validation failed",
    };
  }
}

/**
 * HMAC Middleware Wrapper - Higher-order function for API routes
 * 
 * Usage:
 * 
 * export const POST = withHMAC(async (req, body) => {
 *   // Your handler code here
 *   // body is already parsed and validated
 *   return NextResponse.json({ success: true });
 * });
 */
export function withHMAC(
  handler: (req: NextRequest, body: any, rawBody: string) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const validation = await validateHMACRequest(req);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "HMAC validation failed" },
        { status: 401 }
      );
    }

    return handler(req, validation.body, validation.rawBody || "");
  };
}

/**
 * Optional HMAC Middleware - Only validates if signature is provided
 * 
 * Useful for endpoints that accept both authenticated and unauthenticated requests
 * 
 * Usage:
 * 
 * export const POST = withOptionalHMAC(async (req, body, isVerified) => {
 *   if (isVerified) {
 *     // Trust external source
 *   } else {
 *     // Validate another way (e.g., Clerk auth)
 *   }
 * });
 */
export function withOptionalHMAC(
  handler: (
    req: NextRequest,
    body: any,
    rawBody: string,
    isVerified: boolean
  ) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const signature = req.headers.get(HMAC_HEADER);
    const rawBody = await req.text();
    
    let isVerified = false;
    let body: any = null;

    if (signature) {
      isVerified = verifyHMAC(rawBody, signature);
      if (!isVerified) {
        return NextResponse.json(
          { error: "Invalid HMAC signature" },
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

    return handler(req, body, rawBody, isVerified);
  };
}

