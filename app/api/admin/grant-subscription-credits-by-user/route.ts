import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { grantCreditsWithExpiry } from "@/lib/actions/credit-grant-with-expiry";

/**
 * POST /api/admin/grant-subscription-credits-by-user
 * Admin endpoint to manually grant credits for a user's active subscription
 * 
 * Body: {
 *   clerkUserId: string, // User's Clerk ID
 *   email?: string, // Alternative: User's email
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
    const { clerkUserId, email, force = false } = body;

    if (!clerkUserId && !email) {
      return NextResponse.json(
        { error: "clerkUserId or email is required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          clerkUserId ? { clerkId: clerkUserId } : undefined,
          email ? { email } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        subscriptions: {
          where: { status: "ACTIVE" },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.subscriptions.length === 0) {
      return NextResponse.json(
        {
          error: "User has no active subscriptions",
          userId: user.clerkId,
          email: user.email,
        },
        { status: 400 }
      );
    }

    // Get the most recent active subscription
    const subscription = user.subscriptions[0];

    if (!subscription.plan) {
      return NextResponse.json(
        { error: "Subscription plan not found" },
        { status: 404 }
      );
    }

    if (subscription.plan.creditsPerCycle <= 0) {
      return NextResponse.json(
        {
          error: `Subscription plan has no credits configured (creditsPerCycle: ${subscription.plan.creditsPerCycle})`,
          plan: subscription.plan.publicName,
          planId: subscription.plan.id,
          hint: "Please configure credits for this plan in Stripe or database",
        },
        { status: 400 }
      );
    }

    // Check if credits were already granted for this period
    if (!force) {
      const existingGrant = await prisma.creditGrant.findFirst({
        where: {
          userId: user.id,
          subscriptionId: subscription.id,
          planId: subscription.planId,
          createdAt: {
            gte: subscription.currentPeriodStart,
          },
        },
      });

      if (existingGrant) {
        const available = existingGrant.amount - existingGrant.usedAmount;
        return NextResponse.json(
          {
            error: "Credits already granted for this subscription period",
            existingGrant: {
              id: existingGrant.id,
              grantedAt: existingGrant.createdAt.toISOString(),
              credits: existingGrant.amount,
              used: existingGrant.usedAmount,
              available,
            },
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
      userId: user.clerkId,
      type: "SUBSCRIPTION",
      amount: subscription.plan.creditsPerCycle,
      expiresAt,
      reason: `Manual admin grant for subscription ${subscription.plan.publicName} (user: ${user.email})`,
      planId: subscription.planId,
      subscriptionId: subscription.id,
      idempotencyKey: `admin:manual:user:${user.clerkId}:${Date.now()}`,
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
      where: { id: user.id },
      select: { creditBalance: true, email: true },
    });

    return NextResponse.json({
      success: true,
      message: "Credits granted successfully",
      user: {
        clerkId: user.clerkId,
        email: user.email,
        oldBalance: user.creditBalance,
        newBalance: updatedUser?.creditBalance || 0,
      },
      subscription: {
        id: subscription.id,
        plan: subscription.plan.publicName,
        creditsPerCycle: subscription.plan.creditsPerCycle,
        status: subscription.status,
      },
      creditsGranted: subscription.plan.creditsPerCycle,
      grant: {
        id: result.grant.id,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[ADMIN_GRANT_SUBSCRIPTION_BY_USER] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to grant subscription credits",
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}

