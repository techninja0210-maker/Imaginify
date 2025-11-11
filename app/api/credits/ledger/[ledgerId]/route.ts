import { NextResponse } from "next/server";
import { withHMAC } from "@/lib/middleware/hmac";
import { prisma } from "@/lib/database/prisma";
import { assertRateLimit, RateLimitError } from "@/lib/services/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 240;

export const GET = withHMAC(async (_req, _body, _rawBody, headers) => {
  const clientId = headers.clientId;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing client identifier", code: "CLIENT_ID_MISSING" },
      { status: 400 }
    );
  }

  try {
    assertRateLimit(`credits:ledger:${clientId}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
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
    const ledgerId = _req.nextUrl.searchParams.get("id") || _req.nextUrl.pathname.split("/").pop();

    if (!ledgerId) {
      return NextResponse.json(
        { error: "ledgerId is required", code: "INVALID_LEDGER_ID" },
        { status: 400 }
      );
    }

    const ledger = await prisma.creditLedger.findUnique({
      where: { id: ledgerId },
      include: {
        user: {
          select: {
            clerkId: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!ledger) {
      return NextResponse.json(
        { error: "Ledger not found", code: "LEDGER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const relatedRefunds = await prisma.creditLedger.findMany({
      where: {
        type: "refund",
        metadata: {
          path: ["originalLedgerId"],
          equals: ledgerId,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalRefunded = relatedRefunds.reduce((sum, entry) => sum + entry.amount, 0);

    const ledgerWithBalance = ledger as typeof ledger & { balanceAfter: number | null };

    return NextResponse.json(
      {
        success: true,
        ledger: {
          id: ledger.id,
          type: ledger.type,
          amount: ledger.amount,
          reason: ledger.reason,
          balanceAfter: ledgerWithBalance.balanceAfter ?? null,
          createdAt: ledger.createdAt,
          breakdown: ledger.breakdown,
          metadata: ledger.metadata,
          environment: ledger.environment,
          status: ledger.status,
          clientId: ledger.clientId,
          externalJobId: ledger.externalJobId,
          idempotencyKey: ledger.idempotencyKey,
          user: ledger.user
            ? {
                clerkId: ledger.user.clerkId,
                email: ledger.user.email,
              }
            : null,
          organization: ledger.organization
            ? {
                id: ledger.organization.id,
                name: ledger.organization.name,
              }
            : null,
          refunds: relatedRefunds.map((entry) => ({
            id: entry.id,
            amount: entry.amount,
            createdAt: entry.createdAt,
            reason: entry.reason,
            idempotencyKey: entry.idempotencyKey,
          })),
          totalRefunded,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[GET /api/credits/ledger/:id] Error:", error);

    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many requests", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
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


