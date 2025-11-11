import { NextResponse } from "next/server";
import { withHMAC } from "@/lib/middleware/hmac";
import { prisma } from "@/lib/database/prisma";
import { deductCredits } from "@/lib/actions/user.actions";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";
import { dispatchCreditEvent } from "@/lib/services/credit-webhooks";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

function validateUserIdentifiers(userId?: string, userEmail?: string) {
  if ((!userId && !userEmail) || (userId && userEmail)) {
    return {
      valid: false,
      error: "Provide either userId or userEmail",
      code: "INVALID_USER_IDENTIFIER",
    };
  }

  return { valid: true };
}

function normalizeBreakdown(breakdown: any): any[] | undefined {
  if (!breakdown) return undefined;
  if (!Array.isArray(breakdown)) {
    throw new Error("breakdown must be an array");
  }

  return breakdown.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Each breakdown item must be an object");
    }

    if (!item.platform || !item.action) {
      throw new Error("Breakdown items require platform and action");
    }

    return {
      platform: item.platform,
      action: item.action,
      units: item.units ?? item.unit_type ?? null,
      unitType: item.unitType ?? item.unit_type ?? null,
      unitPrice: item.unitPrice ?? item.unit_price ?? null,
      subtotal: item.subtotal ?? null,
    };
  });
}

type ResolveUserSuccess = {
  success: true;
  clerkId: string;
  email: string | null;
};

type ResolveUserError = {
  success: false;
  status: number;
  error: string;
  code: string;
};

type ResolveUserResult = ResolveUserSuccess | ResolveUserError;

async function resolveUserId(userId?: string, userEmail?: string): Promise<ResolveUserResult> {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { clerkId: true, isActive: true, creditBalance: true, email: true },
    });

    if (!user) {
      return { success: false, error: "User not found", code: "USER_NOT_FOUND", status: 404 };
    }

    if (!user.isActive) {
      return { success: false, error: "User account is inactive", code: "USER_INACTIVE", status: 403 };
    }

    return { success: true, clerkId: user.clerkId, email: user.email };
  }

  if (userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { clerkId: true, isActive: true, email: true },
    });

    if (!user) {
      return { success: false, error: "User not found", code: "USER_NOT_FOUND", status: 404 };
    }

    if (!user.isActive) {
      return { success: false, error: "User account is inactive", code: "USER_INACTIVE", status: 403 };
    }

    return { success: true, clerkId: user.clerkId, email: user.email };
  }

  return { success: false, error: "Invalid user identifier", code: "INVALID_USER_IDENTIFIER", status: 400 };
}

export const POST = withHMAC(async (req, body, _rawBody, headers) => {
  const clientId = headers.clientId;
  const idempotencyKey = headers.idempotencyKey;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing client identifier", code: "CLIENT_ID_MISSING" },
      { status: 400 }
    );
  }

  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Missing idempotency key", code: "IDEMPOTENCY_KEY_MISSING" },
      { status: 400 }
    );
  }

  try {
    assertRateLimit(`credits:${clientId}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    throw error;
  }

  try {
    const { userId, userEmail, amount, reason, externalJobId, metadata, breakdown } = body || {};

    if (metadata && typeof metadata !== "object") {
      return NextResponse.json(
        { error: "metadata must be an object", code: "INVALID_METADATA" },
        { status: 400 }
      );
    }

    const breakdownItems = normalizeBreakdown(breakdown);
    const userValidation = validateUserIdentifiers(userId, userEmail);

    if (!userValidation.valid) {
      return NextResponse.json(
        { error: userValidation.error, code: userValidation.code },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number", code: "INVALID_AMOUNT" },
        { status: 400 }
      );
    }

    const resolvedUser = await resolveUserId(userId, userEmail);
    if (!resolvedUser.success) {
      const { status, error: errorMessage, code } = resolvedUser;
      return NextResponse.json({ error: errorMessage, code }, { status });
    }

    const deductionResult = await deductCredits(
      resolvedUser.clerkId,
      amount,
      reason || "External credit deduction",
      idempotencyKey,
      {
        metadata,
        breakdown: breakdownItems,
        clientId,
        environment: headers.environment,
        externalJobId,
      }
    );

    if (!deductionResult?.success) {
      return NextResponse.json(
        {
          error: deductionResult?.message || "Failed to deduct credits",
          code: "DEDUCTION_FAILED",
        },
        { status: 500 }
      );
    }

    const idempotent = Boolean(deductionResult.idempotent);
    const sandboxMode = headers.environment === "sandbox" || deductionResult.sandbox;
    const ledgerId = deductionResult.ledgerEntry?.id ?? null;
    const newBalance = sandboxMode
      ? deductionResult.simulatedBalance ?? null
      : deductionResult.updatedUser?.creditBalance ?? null;
    const lowBalanceThreshold =
      deductionResult.updatedUser?.lowBalanceThreshold ?? null;

    if (!sandboxMode) {
      dispatchCreditEvent("credits.deduction.succeeded", {
        ledgerId,
        userId: resolvedUser.clerkId,
        clientId,
        amount,
        reason,
        breakdown: breakdownItems,
        newBalance,
        externalJobId,
        idempotent,
        timestamp: new Date().toISOString(),
      }).catch((error) => {
        console.error("[CREDIT_DEDUCTION_WEBHOOK] Failed", error);
      });

      if (
        typeof newBalance === "number" &&
        typeof lowBalanceThreshold === "number" &&
        newBalance <= lowBalanceThreshold
      ) {
        dispatchCreditEvent("credits.low_balance", {
          userId: resolvedUser.clerkId,
          clientId,
          newBalance,
          threshold: lowBalanceThreshold,
          timestamp: new Date().toISOString(),
        }).catch((error) => {
          console.error("[CREDIT_LOW_BALANCE_WEBHOOK] Failed", error);
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        ledgerId,
        userId: resolvedUser.clerkId,
        userEmail: resolvedUser.email ?? userEmail ?? null,
        deducted: amount,
        newBalance,
        idempotent,
        sandbox: sandboxMode,
        environment: headers.environment,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[POST /api/credits/deductions] Error:", error);

    const message = error?.message || "Internal server error";

    if (message.includes("Insufficient credits")) {
      if (headers.environment !== "sandbox") {
        dispatchCreditEvent("credits.deduction.failed", {
          reason: "INSUFFICIENT_CREDITS",
          message,
        }).catch(() => {});
      }

      return NextResponse.json(
        {
          error: "User does not have enough credits.",
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 }
      );
    }

    if (error?.code === "BALANCE_VERSION_CONFLICT") {
      return NextResponse.json(
        {
          error: "Balance version conflict. Retry with backoff.",
          code: "BALANCE_VERSION_CONFLICT",
        },
        { status: 409 }
      );
    }

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        message: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
});


