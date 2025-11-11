import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withHMAC } from "@/lib/middleware/hmac";
import { prisma } from "@/lib/database/prisma";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";
import { dispatchCreditEvent } from "@/lib/services/credit-webhooks";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

async function getLedgerWithRelations(ledgerId: string) {
  return prisma.creditLedger.findUnique({
    where: { id: ledgerId },
    include: {
      user: true,
      organization: true,
    },
  });
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
    assertRateLimit(`credits:refund:${clientId}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }
    throw error;
  }

  try {
    const { ledgerId, amount, reason, metadata } = body || {};

    if (!ledgerId || typeof ledgerId !== "string") {
      return NextResponse.json(
        { error: "ledgerId is required", code: "INVALID_LEDGER_ID" },
        { status: 400 }
      );
    }

    if (metadata && typeof metadata !== "object") {
      return NextResponse.json(
        { error: "metadata must be an object", code: "INVALID_METADATA" },
        { status: 400 }
      );
    }

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return NextResponse.json(
        { error: "amount must be a positive number", code: "INVALID_AMOUNT" },
        { status: 400 }
      );
    }

    const originalLedger = await getLedgerWithRelations(ledgerId);

    if (!originalLedger) {
      return NextResponse.json(
        { error: "Ledger not found", code: "LEDGER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (originalLedger.type !== "deduction") {
      return NextResponse.json(
        { error: "Only deductions can be refunded", code: "INVALID_LEDGER_TYPE" },
        { status: 400 }
      );
    }

    const absoluteOriginalAmount = Math.abs(originalLedger.amount);
    const refundAmount = amount ? Math.min(amount, absoluteOriginalAmount) : absoluteOriginalAmount;

    const existingRefund = await prisma.creditLedger.findUnique({
      where: { idempotencyKey },
    });

    if (existingRefund) {
      return NextResponse.json(
        {
          success: true,
          idempotent: true,
          ledgerId: existingRefund.id,
          userId: originalLedger.userId,
          refunded: refundAmount,
          newBalance: null,
        },
        { status: 200 }
      );
    }

    const totalRefundedResult = await prisma.creditLedger.aggregate({
      _sum: { amount: true },
      where: {
        type: "refund",
        metadata: {
          path: ["originalLedgerId"],
          equals: ledgerId,
        },
      },
    });

    const totalRefundedSoFar = totalRefundedResult._sum.amount ?? 0;
    const remainingRefundable = absoluteOriginalAmount - totalRefundedSoFar;

    if (remainingRefundable <= 0) {
      return NextResponse.json(
        { error: "Ledger already fully refunded", code: "REFUND_NOT_AVAILABLE" },
        { status: 400 }
      );
    }

    if (refundAmount > remainingRefundable) {
      return NextResponse.json(
        { error: "Refund exceeds remaining deductible amount", code: "REFUND_EXCEEDS_ORIGINAL" },
        { status: 400 }
      );
    }

    const refundResult = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: originalLedger.userId || "" },
        select: {
          id: true,
          clerkId: true,
          creditBalance: true,
          creditBalanceVersion: true,
        },
      });

      if (!user) {
        throw new Error("User not found for refund");
      }

      const currentVersion = user.creditBalanceVersion;
      const updateResult = await tx.user.updateMany({
        where: { id: user.id, creditBalanceVersion: currentVersion },
        data: {
          creditBalance: { increment: refundAmount },
          creditBalanceVersion: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        const conflict: any = new Error("Balance version conflict");
        conflict.code = "BALANCE_VERSION_CONFLICT";
        throw conflict;
      }

      const updatedUser = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          clerkId: true,
          creditBalance: true,
          creditBalanceVersion: true,
        },
      });

      if (!updatedUser) {
        throw new Error("User not found after refund");
      }

      if (originalLedger.organizationId) {
        const orgBalance = await tx.creditBalance.findUnique({
          where: { organizationId: originalLedger.organizationId },
        });

        if (orgBalance) {
          const orgUpdateResult = await tx.creditBalance.updateMany({
            where: { organizationId: originalLedger.organizationId, version: orgBalance.version },
            data: {
              balance: { increment: refundAmount },
              version: { increment: 1 },
            },
          });

          if (orgUpdateResult.count === 0) {
            const orgConflict: any = new Error("Organization balance version conflict");
            orgConflict.code = "BALANCE_VERSION_CONFLICT";
            throw orgConflict;
          }
        }
      }

      const ledgerMetadata = {
        ...metadata,
        originalLedgerId: ledgerId,
        clientId,
      };
      const breakdownData = originalLedger.breakdown as Prisma.JsonValue | null;

      const refundLedger = await tx.creditLedger.create({
        data: {
          organizationId: originalLedger.organizationId,
          userId: user.id,
          type: "refund",
          amount: refundAmount,
          reason: reason || `Refund for ledger ${ledgerId}`,
          metadata: ledgerMetadata,
          idempotencyKey,
          externalJobId: originalLedger.externalJobId,
          clientId,
          environment: headers.environment,
          breakdown: (breakdownData as Prisma.InputJsonValue) ?? undefined,
          balanceAfter: updatedUser.creditBalance,
          status: "completed",
        },
      });

      return { refundLedger, updatedUser };
    });

    if (headers.environment !== "sandbox") {
      dispatchCreditEvent("credits.refund.succeeded", {
        originalLedgerId: ledgerId,
        refundLedgerId: refundResult.refundLedger.id,
        amount: refundAmount,
        clientId,
        userId: refundResult.updatedUser.clerkId,
        timestamp: new Date().toISOString(),
      }).catch((error) => {
        console.error("[CREDIT_REFUND_WEBHOOK] Failed", error);
      });
    }

    return NextResponse.json(
      {
        success: true,
        ledgerId: refundResult.refundLedger.id,
        originalLedgerId: ledgerId,
        userId: refundResult.updatedUser.clerkId,
        refunded: refundAmount,
        newBalance: refundResult.updatedUser.creditBalance,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[POST /api/credits/refunds] Error:", error);

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
        message: process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
});


