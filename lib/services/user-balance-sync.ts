/**
 * User Balance Sync Service
 * 
 * Syncs user.creditBalance with the sum of active credit grants
 * This ensures the displayed balance matches the actual available credits
 */

import { prisma } from "@/lib/database/prisma";
import { getUserEffectiveBalance } from "./credit-grants";

/**
 * Sync user's creditBalance with their effective balance from grants
 * Call this periodically or after grant operations
 */
export async function syncUserBalance(userId: string): Promise<{ synced: boolean; oldBalance: number; newBalance: number }> {
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, creditBalance: true, creditBalanceVersion: true }
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get effective balance from grants
  const effectiveBalance = await getUserEffectiveBalance(userId);

  // If they match, no sync needed
  if (user.creditBalance === effectiveBalance) {
    return {
      synced: false,
      oldBalance: user.creditBalance,
      newBalance: effectiveBalance
    };
  }

  // Update user balance
  const updateResult = await prisma.user.updateMany({
    where: {
      clerkId: userId,
      creditBalanceVersion: user.creditBalanceVersion
    },
    data: {
      creditBalance: effectiveBalance,
      creditBalanceVersion: { increment: 1 }
    }
  });

  if (updateResult.count === 0) {
    // Version conflict, retry once
    const retryUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { creditBalanceVersion: true }
    });

    if (retryUser) {
      const retryResult = await prisma.user.updateMany({
        where: {
          clerkId: userId,
          creditBalanceVersion: retryUser.creditBalanceVersion
        },
        data: {
          creditBalance: effectiveBalance,
          creditBalanceVersion: { increment: 1 }
        }
      });

      if (retryResult.count === 0) {
        throw new Error("Failed to sync balance after retry");
      }
    }
  }

  return {
    synced: true,
    oldBalance: user.creditBalance,
    newBalance: effectiveBalance
  };
}

/**
 * Sync all users' balances (for cron job)
 */
export async function syncAllUserBalances(): Promise<{ synced: number; failed: number }> {
  const users = await prisma.user.findMany({
    select: { clerkId: true }
  });

  let synced = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const result = await syncUserBalance(user.clerkId);
      if (result.synced) {
        synced++;
      }
    } catch (error) {
      console.error(`Failed to sync balance for user ${user.clerkId}:`, error);
      failed++;
    }
  }

  return { synced, failed };
}

