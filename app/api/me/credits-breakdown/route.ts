import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { getActiveCreditGrants } from "@/lib/services/credit-grants";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/credits-breakdown
 * Get detailed credit breakdown with subscription vs top-up credits and expiry dates
 */
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get active credit grants
    const summary = await getActiveCreditGrants(user.id);

    // Get user's active subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE"
      },
      include: {
        plan: true
      },
      orderBy: {
        currentPeriodEnd: "desc"
      }
    });

    // Get upcoming expiring grants (within 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    const expiringGrants = summary.grants.filter(grant => {
      const expiryDate = new Date(grant.expiresAt);
      return expiryDate <= sevenDaysFromNow && expiryDate > now;
    });

    // Get next renewal date
    const nextRenewal = subscription?.currentPeriodEnd || null;

    return NextResponse.json({
      totalAvailable: summary.totalAvailable,
      subscriptionCredits: summary.subscriptionCredits,
      topUpCredits: summary.topUpCredits,
      grants: summary.grants.map(grant => ({
        id: grant.id,
        type: grant.type,
        available: grant.available,
        total: grant.total,
        used: grant.used,
        expiresAt: grant.expiresAt.toISOString(),
        expiresInDays: Math.ceil((new Date(grant.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      })),
      subscription: subscription ? {
        id: subscription.id,
        planName: subscription.plan.publicName,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        renewsOn: subscription.currentPeriodEnd.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      } : null,
      expiringSoon: expiringGrants.map(grant => ({
        id: grant.id,
        type: grant.type,
        available: grant.available,
        expiresAt: grant.expiresAt.toISOString(),
        expiresInDays: Math.ceil((new Date(grant.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      })),
      nextRenewal: nextRenewal ? nextRenewal.toISOString() : null
    });
  } catch (error) {
    console.error("Error in /api/me/credits-breakdown:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

