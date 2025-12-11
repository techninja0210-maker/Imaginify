"use server";

import { prisma } from "@/lib/database/prisma";

/**
 * Get auto top-up settings (admin-configured)
 * Returns default values if not configured
 */
export async function getAutoTopUpSettings() {
  try {
    const settings = await prisma.autoTopUpSettings.findFirst({
      where: { isActive: true },
      include: {
        topUpPlan: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (settings) {
      return {
        triggerThreshold: settings.triggerThreshold,
        topUpPlanId: settings.topUpPlanId,
        topUpPlan: {
          id: settings.topUpPlan.id,
          internalId: settings.topUpPlan.internalId,
          publicName: settings.topUpPlan.publicName,
          priceUsd: settings.topUpPlan.priceUsd,
          creditsGranted: settings.topUpPlan.creditsGranted,
          stripePriceId: settings.topUpPlan.stripePriceId,
        },
      };
    }

    // Return default values if not configured
    return {
      triggerThreshold: 200,
      topUpPlanId: null,
      topUpPlan: null,
    };
  } catch (error) {
    console.error("[AUTO_TOP_UP] Error fetching settings:", error);
    // Return defaults on error
    return {
      triggerThreshold: 200,
      topUpPlanId: null,
      topUpPlan: null,
    };
  }
}

/**
 * Update auto top-up preference for a user
 */
export async function updateUserAutoTopUpPreference(
  userId: string,
  enabled: boolean
) {
  try {
    await prisma.user.update({
      where: { clerkId: userId },
      data: { autoTopUpEnabled: enabled },
    });
    return { success: true };
  } catch (error) {
    console.error("[AUTO_TOP_UP] Error updating user preference:", error);
    throw new Error("Failed to update auto top-up preference");
  }
}

