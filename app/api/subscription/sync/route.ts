import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";
import { grantCreditsWithExpiry } from "@/lib/actions/credit-grant-with-expiry";
import { findOrCreateSubscriptionPlan } from "@/lib/services/stripe-plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * POST /api/subscription/sync
 * User endpoint to sync their own Stripe subscription to database
 * This is a fallback in case the webhook failed
 * Handles: new subscriptions, plan upgrades, plan downgrades, and subscription updates
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get Stripe customer ID
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      return NextResponse.json({
        error: "No Stripe customer ID found. Please contact support.",
      }, { status: 400 });
    }

    // Get active subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No active Stripe subscription found",
      });
    }

    const subscription = subscriptions.data[0];
    const stripeSubscriptionId = subscription.id;

    // Get price ID and find/create plan
    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
      return NextResponse.json(
        { error: "No price ID found in subscription" },
        { status: 400 }
      );
    }

    const planResult = await findOrCreateSubscriptionPlan(priceId);
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planResult.id },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Failed to find or create subscription plan" },
        { status: 500 }
      );
    }

    if (plan.creditsPerCycle <= 0) {
      return NextResponse.json(
        {
          error: `Subscription plan has no credits configured`,
          plan: plan.publicName,
        },
        { status: 400 }
      );
    }

    // Get existing subscription from database
    const existingSubscription = await prisma.userSubscription.findFirst({
      where: {
        userId: user.id,
        OR: [
          { stripeSubscriptionId }, // Match by Stripe subscription ID
          { status: "ACTIVE" }, // Or any active subscription
        ],
      },
      include: {
        plan: true,
      },
    });

    // Determine if this is a plan change (upgrade or downgrade)
    const isPlanChange = existingSubscription && existingSubscription.planId !== plan.id;
    const isUpgrade = isPlanChange && existingSubscription && plan.priceUsd > existingSubscription.plan.priceUsd;
    const isDowngrade = isPlanChange && existingSubscription && plan.priceUsd < existingSubscription.plan.priceUsd;

    // Map Stripe status
    let subscriptionStatus: "ACTIVE" | "CANCELED" | "PAST_DUE" | "UNPAID" | "TRIALING" = "ACTIVE";
    if (subscription.status === "canceled") subscriptionStatus = "CANCELED";
    else if (subscription.status === "past_due") subscriptionStatus = "PAST_DUE";
    else if (subscription.status === "unpaid") subscriptionStatus = "UNPAID";
    else if (subscription.status === "trialing") subscriptionStatus = "TRIALING";
    else if (subscription.status === "active") subscriptionStatus = "ACTIVE";

    // Get period dates
    const currentPeriodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : new Date();
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create or update UserSubscription
    const userSubscription = await prisma.userSubscription.upsert({
      where: { stripeSubscriptionId },
      update: {
        planId: plan.id,
        status: subscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      },
      create: {
        userId: user.id,
        planId: plan.id,
        stripeSubscriptionId,
        status: subscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      },
    });

    console.log(`[SUBSCRIPTION_SYNC] ${existingSubscription ? 'Updated' : 'Created'} subscription: ${userSubscription.id}, plan: ${plan.publicName}`);
    if (isPlanChange) {
      console.log(`[SUBSCRIPTION_SYNC] Plan change detected: ${isUpgrade ? 'UPGRADE' : isDowngrade ? 'DOWNGRADE' : 'CHANGE'} from ${existingSubscription!.plan.publicName} to ${plan.publicName}`);
    }

    // Determine credit grant logic based on scenario
    let creditsGranted = 0;
    let grantInfo = null;
    let needsCreditGrant = false;

    if (subscriptionStatus === "ACTIVE") {
      if (!existingSubscription) {
        // NEW SUBSCRIPTION: Check if credits already granted
        const existingGrant = await prisma.creditGrant.findFirst({
          where: {
            userId: user.id,
            subscriptionId: userSubscription.id,
            type: "SUBSCRIPTION",
            createdAt: {
              gte: currentPeriodStart,
            },
          },
        });

        if (!existingGrant) {
          needsCreditGrant = true;
        } else {
          grantInfo = {
            existing: true,
            credits: existingGrant.amount,
            available: existingGrant.amount - existingGrant.usedAmount,
          };
        }
      } else if (isPlanChange) {
        // PLAN CHANGE: Check if credits already granted for the new plan in current period
        const existingGrantForNewPlan = await prisma.creditGrant.findFirst({
          where: {
            userId: user.id,
            subscriptionId: userSubscription.id,
            planId: plan.id,
            type: "SUBSCRIPTION",
            createdAt: {
              gte: currentPeriodStart,
            },
          },
        });

        if (!existingGrantForNewPlan) {
          needsCreditGrant = true;
        } else {
          grantInfo = {
            existing: true,
            credits: existingGrantForNewPlan.amount,
            available: existingGrantForNewPlan.amount - existingGrantForNewPlan.usedAmount,
          };
        }
      } else {
        // SAME PLAN: Check if credits already granted for current period
        const existingGrant = await prisma.creditGrant.findFirst({
          where: {
            userId: user.id,
            subscriptionId: userSubscription.id,
            createdAt: {
              gte: currentPeriodStart,
            },
          },
        });

        if (!existingGrant) {
          needsCreditGrant = true;
        } else {
          grantInfo = {
            existing: true,
            credits: existingGrant.amount,
            available: existingGrant.amount - existingGrant.usedAmount,
          };
        }
      }

      // Grant credits if needed
      if (needsCreditGrant) {
        const expiresAt = new Date(userSubscription.currentPeriodEnd);
        expiresAt.setDate(expiresAt.getDate() + plan.creditExpiryDays);

        let idempotencyKey: string;
        let reason: string;

        if (!existingSubscription) {
          // New subscription
          idempotencyKey = `stripe:subscription:created:${stripeSubscriptionId}`;
          reason = `Background sync for new subscription ${plan.publicName} (webhook may have failed)`;
        } else if (isPlanChange) {
          // Plan change (upgrade/downgrade)
          idempotencyKey = `stripe:subscription:${isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'change'}:${stripeSubscriptionId}:${Date.now()}`;
          reason = isUpgrade
            ? `Subscription upgrade to ${plan.publicName} - full monthly allowance (synced)`
            : isDowngrade
            ? `Subscription downgrade to ${plan.publicName} - credit grant (synced)`
            : `Plan change to ${plan.publicName} - credit grant (synced)`;
        } else {
          // Same plan, just missing credits
          idempotencyKey = `stripe:subscription:created:${stripeSubscriptionId}`;
          reason = `Background sync for subscription ${plan.publicName} (credits missing)`;
        }

        const result = await grantCreditsWithExpiry({
          userId: user.clerkId,
          type: "SUBSCRIPTION",
          amount: plan.creditsPerCycle,
          expiresAt,
          reason,
          planId: plan.id,
          subscriptionId: userSubscription.id,
          idempotencyKey,
          metadata: {
            manuallySynced: true,
            syncedAt: new Date().toISOString(),
            stripeSubscriptionId,
            periodStart: userSubscription.currentPeriodStart.toISOString(),
            periodEnd: userSubscription.currentPeriodEnd.toISOString(),
            isPlanChange,
            isUpgrade: isUpgrade || undefined,
            isDowngrade: isDowngrade || undefined,
            oldPlanId: existingSubscription?.planId,
            oldPlanName: existingSubscription?.plan.publicName,
          },
        });

        creditsGranted = plan.creditsPerCycle;
        grantInfo = {
          existing: false,
          credits: plan.creditsPerCycle,
          expiresAt: expiresAt.toISOString(),
          grantId: result.grant.id,
          reason,
        };

        // For upgrades, clear pending downgrades
        if (isUpgrade) {
          await prisma.user.update({
            where: { clerkId: user.clerkId },
            data: {
              pendingPlanId: null,
            },
          });
        }

        console.log(`[SUBSCRIPTION_SYNC] ✅ Credits granted: ${creditsGranted} credits for plan ${plan.publicName}`);
      }
    }

    // Get updated user balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { creditBalance: true },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription synced successfully",
      subscription: {
        plan: plan.publicName,
        creditsPerCycle: plan.creditsPerCycle,
        stripeSubscriptionId,
      },
      isPlanChange,
      isUpgrade,
      isDowngrade,
      creditsGranted,
      grantInfo,
      oldBalance: user.creditBalance,
      newBalance: updatedUser?.creditBalance || 0,
    });
  } catch (error: any) {
    console.error("[SUBSCRIPTION_SYNC] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to sync subscription",
      },
      { status: 500 }
    );
  }
}
