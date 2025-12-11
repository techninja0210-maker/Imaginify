import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { grantCreditsWithExpiry } from "@/lib/actions/credit-grant-with-expiry";

/**
 * POST /api/admin/grant-subscription-credits
 * Admin endpoint to manually grant credits for an existing subscription
 * 
 * Body: {
 *   subscriptionId: string, // UserSubscription.id OR stripeSubscriptionId
 *   force: boolean // Force grant even if already granted
 * }
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAdmin();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subscriptionId, force = false } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      );
    }

    // Find subscription by ID or stripeSubscriptionId
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        OR: [
          { id: subscriptionId },
          { stripeSubscriptionId: subscriptionId },
        ],
      },
      include: {
        plan: true,
        user: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (subscription.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error: `Subscription is not active (status: ${subscription.status})`,
          subscriptionStatus: subscription.status,
        },
        { status: 400 }
      );
    }

    if (!subscription.plan) {
      return NextResponse.json(
        { error: "Subscription plan not found" },
        { status: 404 }
      );
    }

    // Check if credits were already granted for this period
    if (!force) {
      const existingGrant = await prisma.creditGrant.findFirst({
        where: {
          userId: subscription.userId,
          subscriptionId: subscription.id,
          planId: subscription.planId,
          createdAt: {
            gte: subscription.currentPeriodStart,
          },
        },
      });

      if (existingGrant) {
        return NextResponse.json(
          {
            error: "Credits already granted for this subscription period",
            existingGrantId: existingGrant.id,
            grantedAt: existingGrant.createdAt.toISOString(),
            credits: existingGrant.amount,
            used: existingGrant.usedAmount,
            available: existingGrant.amount - existingGrant.usedAmount,
            hint: "Use force: true to grant anyway",
          },
          { status: 400 }
        );
      }
    }

    // Grant credits
    const expiresAt = new Date(subscription.currentPeriodEnd);
    expiresAt.setDate(expiresAt.getDate() + subscription.plan.creditExpiryDays);

    const result = await grantCreditsWithExpiry({
      userId: subscription.user.user.clerkId,
      type: "SUBSCRIPTION",
      amount: subscription.plan.creditsPerCycle,
      expiresAt,
      reason: `Manual admin grant for subscription ${subscription.plan.publicName} (${subscription.id})`,
      planId: subscription.planId,
      subscriptionId: subscription.id,
      idempotencyKey: `admin:manual:subscription:${subscription.id}:${Date.now()}`,
      metadata: {
        adminGranted: true,
        grantedBy: currentUser.id,
        grantedAt: new Date().toISOString(),
        periodStart: subscription.currentPeriodStart.toISOString(),
        periodEnd: subscription.currentPeriodEnd.toISOString(),
      },
    });

    // Verify user balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: subscription.userId },
      select: { creditBalance: true, email: true },
    });

    return NextResponse.json({
      success: true,
      message: "Credits granted successfully",
      subscription: {
        id: subscription.id,
        plan: subscription.plan.publicName,
        status: subscription.status,
      },
      creditsGranted: subscription.plan.creditsPerCycle,
      newBalance: updatedUser?.creditBalance || 0,
      grant: {
        id: result.grant.id,
        expiresAt: expiresAt.toISOString(),
      },
      user: {
        email: updatedUser?.email,
        balance: updatedUser?.creditBalance,
      },
    });
  } catch (error: any) {
    console.error("[ADMIN_GRANT_SUBSCRIPTION] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to grant subscription credits",
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}

