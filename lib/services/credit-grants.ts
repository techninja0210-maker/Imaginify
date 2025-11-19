/**
 * Credit Grants Service
 * 
 * Handles credit expiry tracking, type differentiation, and ordering logic
 */

import { prisma } from "@/lib/database/prisma";
import { CreditType } from "@prisma/client";

export interface CreditGrantSummary {
  totalAvailable: number;
  subscriptionCredits: number;
  topUpCredits: number;
  grants: Array<{
    id: string;
    type: CreditType;
    available: number;
    total: number;
    used: number;
    expiresAt: Date;
  }>;
}

/**
 * Get all active (non-expired, non-exhausted) credit grants for a user
 * Sorted by priority: subscription credits first, then top-ups (earliest expiring first)
 */
export async function getActiveCreditGrants(userId: string): Promise<CreditGrantSummary> {
  const now = new Date();

  // Get all grants that are not expired and have available credits
  const grants = await prisma.creditGrant.findMany({
    where: {
      userId,
      expiresAt: { gt: now }, // Not expired
      // Has available credits: amount > usedAmount
    },
    orderBy: [
      // Subscription credits first
      { type: "asc" }, // SUBSCRIPTION comes before TOPUP alphabetically
      // Then by expiry date (earliest first)
      { expiresAt: "asc" },
    ],
  });

  // Filter grants with available credits and calculate totals
  let totalAvailable = 0;
  let subscriptionCredits = 0;
  let topUpCredits = 0;

  const grantSummaries = grants
    .map((grant) => {
      const available = grant.amount - grant.usedAmount;
      if (available <= 0) return null; // Skip exhausted grants

      if (grant.type === "SUBSCRIPTION") {
        subscriptionCredits += available;
      } else {
        topUpCredits += available;
      }
      totalAvailable += available;

      return {
        id: grant.id,
        type: grant.type,
        available,
        total: grant.amount,
        used: grant.usedAmount,
        expiresAt: grant.expiresAt,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return {
    totalAvailable,
    subscriptionCredits,
    topUpCredits,
    grants: grantSummaries,
  };
}

/**
 * Deduct credits from grants following the priority order:
 * 1. Subscription credits first (by expiry date, soonest first)
 * 2. Then top-up credits (by expiry date, soonest first)
 * 
 * Returns the grants that were used and the amounts deducted from each
 */
export async function deductCreditsFromGrants(
  userId: string,
  amount: number
): Promise<Array<{ grantId: string; amount: number }>> {
  const now = new Date();
  let remaining = amount;
  const deductions: Array<{ grantId: string; amount: number }> = [];

  // Get all active grants, sorted by priority
  const grants = await prisma.creditGrant.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
    },
    orderBy: [
      { type: "asc" }, // SUBSCRIPTION first
      { expiresAt: "asc" }, // Earliest expiring first
    ],
  });

  // Deduct from grants in order
  for (const grant of grants) {
    if (remaining <= 0) break;

    const available = grant.amount - grant.usedAmount;
    if (available <= 0) continue; // Skip exhausted grants

    const toDeduct = Math.min(remaining, available);

    // Update grant
    await prisma.creditGrant.update({
      where: { id: grant.id },
      data: {
        usedAmount: { increment: toDeduct },
      },
    });

    deductions.push({
      grantId: grant.id,
      amount: toDeduct,
    });

    remaining -= toDeduct;
  }

  if (remaining > 0) {
    throw new Error(
      `Insufficient credits. Available: ${amount - remaining}, Required: ${amount}`
    );
  }

  return deductions;
}

/**
 * Create a credit grant (for subscriptions or top-ups)
 */
export async function createCreditGrant(params: {
  userId: string;
  type: CreditType;
  amount: number;
  expiresAt: Date;
  planId?: string;
  subscriptionId?: string;
  topUpPurchaseId?: string;
  ledgerId?: string;
  metadata?: Record<string, any>;
}): Promise<{ id: string }> {
  const grant = await prisma.creditGrant.create({
    data: {
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      expiresAt: params.expiresAt,
      planId: params.planId,
      subscriptionId: params.subscriptionId,
      topUpPurchaseId: params.topUpPurchaseId,
      ledgerId: params.ledgerId,
      metadata: params.metadata || undefined,
    },
  });

  return { id: grant.id };
}

/**
 * Get user's effective credit balance (sum of all active grants)
 * This is the "real" balance that should be used for checks
 */
export async function getUserEffectiveBalance(userId: string): Promise<number> {
  const summary = await getActiveCreditGrants(userId);
  return summary.totalAvailable;
}

/**
 * Clean up expired grants (optional: can be run as a cron job)
 */
export async function cleanupExpiredGrants(): Promise<{ cleaned: number }> {
  const now = new Date();

  // Find all expired grants
  const expiredGrants = await prisma.creditGrant.findMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  // Mark expired grants with unused credits as fully used (effectively expiring them)
  // Note: We don't delete them for audit purposes
  let cleaned = 0;
  for (const grant of expiredGrants) {
    const unused = grant.amount - grant.usedAmount;
    if (unused > 0) {
      await prisma.creditGrant.update({
        where: { id: grant.id },
        data: {
          usedAmount: grant.amount, // Mark as fully used
        },
      });
      cleaned++;
    }
  }

  return { cleaned };
}

