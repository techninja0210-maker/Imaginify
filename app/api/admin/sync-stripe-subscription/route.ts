import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";
import { grantCreditsWithExpiry } from "@/lib/actions/credit-grant-with-expiry";
import { findOrCreateSubscriptionPlan } from "@/lib/services/stripe-plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * POST /api/admin/sync-stripe-subscription
 * Admin endpoint to manually sync a Stripe subscription to database
 * 
 * Body: {
 *   stripeSubscriptionId?: string, // Stripe subscription ID (starts with sub_)
 *   email?: string, // User's email (will find most recent subscription)
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
    const { stripeSubscriptionId, email } = body;

    if (!stripeSubscriptionId && !email) {
      return NextResponse.json(
        { error: "stripeSubscriptionId or email is required" },
        { status: 400 }
      );
    }

    // Get subscription from Stripe
    let subscription: Stripe.Subscription;
    let customer: Stripe.Customer;

    if (stripeSubscriptionId) {
      subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      customer = (await stripe.customers.retrieve(subscription.customer as string)) as Stripe.Customer;
    } else {
      // Find by email
      const customers = await stripe.customers.list({
        email: email!,
        limit: 1,
      });

      if (customers.data.length === 0) {
        return NextResponse.json(
          { error: `No Stripe customer found for email: ${email}` },
          { status: 404 }
        );
      }

      customer = customers.data[0];
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 10,
      });

      if (subscriptions.data.length === 0) {
        return NextResponse.json(
          { error: `No subscriptions found for customer: ${email}` },
          { status: 404 }
        );
      }

      // Get most recent active subscription, or first one
      subscription = subscriptions.data.find((s) => s.status === "active") || subscriptions.data[0];
    }

    // Find user in database
    let user = await prisma.user.findFirst({
      where: { stripeCustomerId: customer.id },
    });

    if (!user) {
      // Try by email
      user = await prisma.user.findFirst({
        where: { email: customer.email! },
      });

      if (!user) {
        return NextResponse.json(
          {
            error: `User not found in database for email: ${customer.email}`,
            stripeCustomerId: customer.id,
            hint: "User may need to be created first or linked to Stripe customer",
          },
          { status: 404 }
        );
      }

      // Link customer ID
      await prisma.user.update({
        where: { clerkId: user.clerkId },
        data: { stripeCustomerId: customer.id },
      });
    }

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
          error: `Subscription plan has no credits configured (creditsPerCycle: ${plan.creditsPerCycle})`,
          plan: plan.publicName,
          planId: plan.id,
          stripePriceId: priceId,
          hint: "Please add 'credits' metadata to Stripe price",
        },
        { status: 400 }
      );
    }

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
      where: { stripeSubscriptionId: subscription.id },
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
        stripeSubscriptionId: subscription.id,
        status: subscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      },
    });

    // Check if credits were already granted
    const existingGrant = await prisma.creditGrant.findFirst({
      where: {
        userId: user.id,
        subscriptionId: userSubscription.id,
        planId: plan.id,
        createdAt: {
          gte: userSubscription.currentPeriodStart,
        },
      },
    });

    let creditsGranted = 0;
    let grantInfo = null;

    if (existingGrant) {
      const available = existingGrant.amount - existingGrant.usedAmount;
      grantInfo = {
        existing: true,
        credits: existingGrant.amount,
        available,
        used: existingGrant.usedAmount,
        expiresAt: existingGrant.expiresAt.toISOString(),
      };
    } else if (subscriptionStatus === "ACTIVE") {
      // Grant credits
      const expiresAt = new Date(userSubscription.currentPeriodEnd);
      expiresAt.setDate(expiresAt.getDate() + plan.creditExpiryDays);

      const result = await grantCreditsWithExpiry({
        userId: user.clerkId,
        type: "SUBSCRIPTION",
        amount: plan.creditsPerCycle,
        expiresAt,
        reason: `Manual admin sync for subscription ${plan.publicName} (${subscription.id})`,
        planId: plan.id,
        subscriptionId: userSubscription.id,
        idempotencyKey: `admin:sync:${subscription.id}:${Date.now()}`,
        metadata: {
          manuallySynced: true,
          syncedBy: currentUser.id,
          syncedAt: new Date().toISOString(),
          stripeSubscriptionId: subscription.id,
          periodStart: userSubscription.currentPeriodStart.toISOString(),
          periodEnd: userSubscription.currentPeriodEnd.toISOString(),
        },
      });

      creditsGranted = plan.creditsPerCycle;
      grantInfo = {
        existing: false,
        credits: plan.creditsPerCycle,
        expiresAt: expiresAt.toISOString(),
        grantId: result.grant.id,
      };
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
        stripeSubscriptionId: subscription.id,
        status: subscriptionStatus,
        plan: plan.publicName,
        creditsPerCycle: plan.creditsPerCycle,
        periodStart: currentPeriodStart.toISOString(),
        periodEnd: currentPeriodEnd.toISOString(),
      },
      user: {
        email: user.email,
        clerkId: user.clerkId,
        oldBalance: user.creditBalance,
        newBalance: updatedUser?.creditBalance || 0,
      },
      userSubscription: {
        id: userSubscription.id,
        status: subscriptionStatus,
      },
      creditsGranted,
      grantInfo,
    });
  } catch (error: any) {
    console.error("[ADMIN_SYNC_SUBSCRIPTION] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to sync subscription",
        details: error?.stack,
      },
      { status: 500 }
    );
  }
}

