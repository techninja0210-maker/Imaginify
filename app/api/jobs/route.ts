import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';
import { deductCredits } from '@/lib/actions/user.actions';
import { checkAndNotifyLowBalance } from '@/lib/services/notifications';

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs
 * Create a job from a quote (locks quote + deducts credits atomically)
 * 
 * Body: { quoteId: string, idempotencyKey?: string }
 */
export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { quoteId, idempotencyKey } = body;

    if (!quoteId) {
      return NextResponse.json({ error: 'quoteId is required' }, { status: 400 });
    }

    // Resolve user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        organizationMembers: {
          include: { organization: true }
        }
      }
    });

    if (!user || !user.organizationMembers.length) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
    }

    const organizationId = user.organizationMembers[0].organization.id;

    // Atomic transaction: lock quote + deduct credits + create job
    const result = await prisma.$transaction(async (tx) => {
      // Get and lock the quote
      const quote = await tx.jobQuote.findUnique({
        where: { id: quoteId }
      });

      if (!quote) {
        throw new Error('Quote not found');
      }

      if (quote.userId !== user.id) {
        throw new Error('Unauthorized: Quote belongs to different user');
      }

      if (quote.status !== 'active') {
        throw new Error(`Quote is no longer active (status: ${quote.status})`);
      }

      if (quote.expiresAt < new Date()) {
        throw new Error('Quote has expired');
      }

      // Check user has enough credits using the new grant system
      const now = new Date();
      const activeGrants = await tx.creditGrant.findMany({
        where: {
          userId: user.id,
          expiresAt: { gt: now },
        },
        orderBy: [
          { type: "asc" }, // SUBSCRIPTION first
          { expiresAt: "asc" }, // Earliest expiring first
        ],
      });

      // Calculate total available credits
      let totalAvailable = 0;
      for (const grant of activeGrants) {
        const available = grant.amount - grant.usedAmount;
        if (available > 0) {
          totalAvailable += available;
        }
      }

      if (totalAvailable < quote.totalCredits) {
        throw new Error(`Insufficient credits. Available: ${totalAvailable}, Required: ${quote.totalCredits}. Please top up or upgrade your plan.`);
      }

      // Create job
      const job = await tx.job.create({
        data: {
          organizationId: quote.organizationId,
          userId: quote.userId,
          title: `Job - ${quote.workflowType}`,
          description: `Generated from quote ${quoteId}`,
          quotedCredits: quote.totalCredits,
          quotedAt: quote.createdAt,
          confirmedAt: new Date(),
          status: 'confirmed',
          totalRetailCostCredits: quote.totalCredits,
          totalInternalCostUsd: (quote.breakdown as any)?.internalUsd || null,
          metadata: quote.parameters as any
        }
      });

      // Deduct from grants in priority order (subscription first, then top-ups)
      let remaining = quote.totalCredits;
      const grantDeductions: Array<{ grantId: string; amount: number }> = [];

      // Re-fetch grants within transaction to ensure consistency
      const grantsInTx = await tx.creditGrant.findMany({
        where: {
          userId: user.id,
          expiresAt: { gt: now },
        },
        orderBy: [
          { type: "asc" },
          { expiresAt: "asc" },
        ],
      });

      for (const grant of grantsInTx) {
        if (remaining <= 0) break;

        const available = grant.amount - grant.usedAmount;
        if (available <= 0) continue; // Skip exhausted grants

        const toDeduct = Math.min(remaining, available);

        // Update grant
        await tx.creditGrant.update({
          where: { id: grant.id },
          data: {
            usedAmount: { increment: toDeduct },
          },
        });

        grantDeductions.push({
          grantId: grant.id,
          amount: toDeduct,
        });

        remaining -= toDeduct;
      }

      if (remaining > 0) {
        throw new Error(`Failed to deduct all credits. Remaining: ${remaining}`);
      }

      // Create ledger entry
      const idemKey = idempotencyKey || `job:${job.id}:${Date.now()}`;
      
      // Check for duplicate idempotency key
      const existingLedger = await tx.creditLedger.findUnique({
        where: { idempotencyKey: idemKey }
      });
      
      if (existingLedger) {
        throw new Error('Job already created (idempotency check)');
      }

      await tx.creditLedger.create({
        data: {
          organizationId: quote.organizationId,
          userId: quote.userId,
          jobId: job.id,
          type: 'deduction',
          amount: -quote.totalCredits,
          reason: `Job creation: ${job.id}`,
          idempotencyKey: idemKey,
          metadata: {
            grantDeductions,
            workflowType: quote.workflowType,
          },
        }
      });

      // Update user balance (for backward compatibility)
      await tx.user.update({
        where: { id: user.id },
        data: { 
          creditBalance: { decrement: quote.totalCredits },
          creditBalanceVersion: { increment: 1 },
        }
      });

      // Mirror to org balance (for backward compatibility)
      const orgCredits = await tx.creditBalance.findUnique({
        where: { organizationId: quote.organizationId }
      });
      if (orgCredits) {
        await tx.creditBalance.update({
          where: { organizationId: quote.organizationId },
          data: { 
            balance: { decrement: quote.totalCredits },
            version: { increment: 1 },
          }
        });
      }

      // Mark quote as used
      await tx.jobQuote.update({
        where: { id: quoteId },
        data: { status: 'used' }
      });

      return job;
    });

    // Check and notify if balance is low (after transaction completes)
    // Get updated user balance
    const updatedUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { creditBalance: true },
    });

    if (updatedUser) {
      // Trigger low balance check (non-blocking)
      checkAndNotifyLowBalance(userId, updatedUser.creditBalance).catch((err) => {
        console.error("Error checking low balance after job creation:", err);
      });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: result.id,
        status: result.status,
        quotedCredits: result.quotedCredits,
        confirmedAt: result.confirmedAt,
      }
    });
  } catch (error: any) {
    console.error('[POST /api/jobs] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Failed to create job',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 400 });
  }
}

/**
 * GET /api/jobs
 * List jobs for the authenticated user
 */
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit')) || 20;
    const page = Number(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          title: true,
          status: true,
          quotedCredits: true,
          totalRetailCostCredits: true,
          createdAt: true,
          confirmedAt: true,
          completedAt: true,
        }
      }),
      prisma.job.count({ where: { userId: user.id } })
    ]);

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Failed to fetch jobs'
    }, { status: 500 });
  }
}

