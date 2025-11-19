"use server";

import { prisma } from "@/lib/database/prisma";
import { CreditType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { updateCredits } from "./user.actions";

/**
 * Grant credits with expiry tracking
 * This is the new way to grant credits for subscriptions and top-ups
 */
export async function grantCreditsWithExpiry(params: {
  userId: string;
  type: CreditType;
  amount: number;
  expiresAt: Date;
  reason: string;
  planId?: string;
  subscriptionId?: string;
  topUpPurchaseId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get user
      const user = await tx.user.findUnique({
        where: { clerkId: params.userId },
        include: {
          organizationMembers: {
            include: { organization: true }
          }
        }
      });

      if (!user) {
        throw new Error("User not found");
      }

      const organizationId = user.organizationMembers[0]?.organization?.id;

      // Check idempotency
      if (params.idempotencyKey) {
        const existingLedger = await tx.creditLedger.findUnique({
          where: { idempotencyKey: params.idempotencyKey }
        });

        if (existingLedger) {
          // Check if grant already exists
          const existingGrant = await tx.creditGrant.findFirst({
            where: { ledgerId: existingLedger.id }
          });

          if (existingGrant) {
            console.log(`[GRANT_CREDITS_WITH_EXPIRY] Already processed: ${params.idempotencyKey}`);
            return {
              success: true,
              skipped: true,
              grant: existingGrant,
              user: await tx.user.findUnique({ where: { clerkId: params.userId } })
            };
          }
        }
      }

      // Update user balance (for backward compatibility)
      const currentVersion = user.creditBalanceVersion;
      const updateResult = await tx.user.updateMany({
        where: { clerkId: params.userId, creditBalanceVersion: currentVersion },
        data: {
          creditBalance: { increment: params.amount },
          creditBalanceVersion: { increment: 1 }
        }
      });

      if (updateResult.count === 0) {
        throw new Error("BALANCE_VERSION_CONFLICT");
      }

      const updatedUser = await tx.user.findUnique({
        where: { clerkId: params.userId }
      });

      if (!updatedUser) {
        throw new Error("User not found after credit update");
      }

      // Create ledger entry (organizationId is required, so create org if missing)
      if (!organizationId) {
        throw new Error("Organization ID is required for ledger entry");
      }

      const ledgerEntry = await tx.creditLedger.create({
        data: {
          organizationId,
          userId: updatedUser.id,
          type: 'allocation',
          amount: params.amount,
          reason: params.reason,
          balanceAfter: updatedUser.creditBalance,
          idempotencyKey: params.idempotencyKey || undefined,
          metadata: params.metadata || undefined,
        }
      });

      // Create credit grant
      const grant = await tx.creditGrant.create({
        data: {
          userId: updatedUser.id,
          type: params.type,
          amount: params.amount,
          expiresAt: params.expiresAt,
          planId: params.planId,
          subscriptionId: params.subscriptionId,
          topUpPurchaseId: params.topUpPurchaseId,
          ledgerId: ledgerEntry.id,
          metadata: params.metadata || undefined,
        }
      });

      // Mirror to organization credit_balances
      if (organizationId) {
        try {
          const existing = await tx.creditBalance.findUnique({
            where: { organizationId },
            select: { id: true, balance: true, version: true }
          });

          if (existing) {
            await tx.creditBalance.updateMany({
              where: { organizationId, version: existing.version },
              data: {
                balance: { increment: params.amount },
                version: { increment: 1 }
              }
            });
          } else {
            await tx.creditBalance.create({
              data: {
                organizationId,
                balance: updatedUser.creditBalance,
                lowBalanceThreshold: user.lowBalanceThreshold || 10,
                autoTopUpEnabled: false
              }
            });
          }
        } catch (orgError: any) {
          console.error(`[GRANT_CREDITS_WITH_EXPIRY] Failed to mirror to org balance:`, orgError);
        }
      }

      return {
        success: true,
        grant,
        ledgerEntry,
        user: updatedUser
      };
    }, {
      maxWait: 10000,
      timeout: 20000,
    });

    // Revalidate cache
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/billing');
    revalidatePath('/credits');

    return JSON.parse(JSON.stringify(result));
  } catch (error: any) {
    console.error('[GRANT_CREDITS_WITH_EXPIRY] Error:', error);
    throw new Error(`Failed to grant credits: ${error?.message || 'Unknown error'}`);
  }
}

