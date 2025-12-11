"use server";

import Stripe from "stripe";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export async function startSubscriptionCheckout(
  lineItems: Array<{ priceId: string; quantity: number }>,
  rewardfulReferral?: string,
  autoTopUpEnabled: boolean = true // Default to enabled (pre-checked)
) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const prisma = (await import('@/lib/database/prisma')).prisma;

  // Verify plans are available for new signups (not legacy-only)
  for (const item of lineItems) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { stripePriceId: item.priceId },
    });

    if (plan) {
      if (plan.isLegacyOnly || !plan.isActiveForNewSignups || plan.isHidden) {
        throw new Error(`Plan "${plan.publicName}" is not available for new signups.`);
      }
    }
  }

  // Update user's auto top-up preference immediately (before checkout)
  // This ensures the preference is saved even if checkout is cancelled
  try {
    await prisma.user.update({
      where: { clerkId: userId },
      data: { autoTopUpEnabled },
    });
  } catch (error) {
    console.error("[CHECKOUT] Failed to update auto top-up preference:", error);
    // Don't fail checkout if preference update fails
  }

  const metadata: Record<string, string> = {
    clerkUserId: userId,
    autoTopUpEnabled: String(autoTopUpEnabled), // Also pass in metadata for webhook
  };

  // Add Rewardful referral if provided
  if (rewardfulReferral) {
    metadata.rewardful_referral = rewardfulReferral;
  }

  // Determine the base URL - detect development vs production
  const getBaseUrl = () => {
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         !process.env.NEXT_PUBLIC_SERVER_URL ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('localhost') ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('127.0.0.1') ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('192.168');
    
    if (isDevelopment) {
      return 'http://localhost:3000';
    }
    
    return process.env.NEXT_PUBLIC_SERVER_URL || 'https://shoppablevideos.com';
  };

  const baseUrl = getBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems.map(item => ({
      price: item.priceId,
      quantity: item.quantity,
    })),
    metadata,
    success_url: `${baseUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
  });

  redirect(session.url!);
}

export async function openCustomerPortal(customerId: string) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Determine the base URL for return URL
  const getBaseUrl = () => {
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         !process.env.NEXT_PUBLIC_SERVER_URL ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('localhost') ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('127.0.0.1');
    
    if (isDevelopment) {
      return 'http://localhost:3000';
    }
    
    return process.env.NEXT_PUBLIC_SERVER_URL || 'https://shoppablevideos.com';
  };

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getBaseUrl()}/billing`,
  });

  redirect(portal.url);
}

export async function ensureStripeCustomerForCurrentUser() {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  // Find existing
  const userRes = await (await import('@/lib/database/prisma')).prisma.user.findUnique({ where: { clerkId: userId } });
  if (!userRes) redirect('/sign-in');
  if (userRes.stripeCustomerId) return userRes.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: userRes.email,
    name: `${userRes.firstName || ''} ${userRes.lastName || ''}`.trim() || undefined,
    metadata: { clerkUserId: userRes.clerkId },
  });

  await (await import('@/lib/database/prisma')).prisma.user.update({
    where: { clerkId: userRes.clerkId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}


export async function openCustomerPortalWithReturnUrl(customerId: string, returnUrl: string) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  redirect(portal.url);
}

export async function changeSubscriptionPlan(
  targetPlanInternalId: string,
  autoTopUpEnabled?: boolean // Optional - if not provided, keep existing preference
) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const prisma = (await import('@/lib/database/prisma')).prisma;

  // Get target plan
  const targetPlan = await prisma.subscriptionPlan.findUnique({
    where: { internalId: targetPlanInternalId },
  });

  if (!targetPlan) {
    throw new Error("Subscription plan not found.");
  }

  if (!targetPlan.stripePriceId) {
    throw new Error("This plan is not ready for checkout. Please contact support.");
  }

  // Get user (need internal ID + Stripe customer)
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { id: true, stripeCustomerId: true },
  });

  if (!user) {
    redirect("/sign-in");
  }

  // Find active subscription (if any)
  const activeSubscription = user.stripeCustomerId
    ? await prisma.userSubscription.findFirst({
        where: {
          userId: user.id,
          status: {
            in: ["ACTIVE", "TRIALING", "PAST_DUE", "UNPAID"],
          },
        },
        include: { plan: true },
      })
    : null;

  // No active subscription → start checkout (if plan is available for new signups)
  if (!activeSubscription) {
    if (targetPlan.isLegacyOnly || !targetPlan.isActiveForNewSignups) {
      throw new Error("This plan is not available for new signups.");
    }

    return startSubscriptionCheckout([{ priceId: targetPlan.stripePriceId, quantity: 1 }]);
  }

  // Already on desired plan
  if (activeSubscription.plan.internalId === targetPlan.internalId) {
    redirect("/billing?message=subscription-unchanged");
  }

  // Ensure this transition is allowed and determine if it's an upgrade or downgrade
  const allowedUpgrades = new Set(activeSubscription.plan.upgradeAllowedTo || []);
  const allowedDowngrades = new Set(activeSubscription.plan.downgradeAllowedTo || []);
  const isUpgrade = allowedUpgrades.has(targetPlan.internalId);
  const isDowngrade = allowedDowngrades.has(targetPlan.internalId);
  const isAllowed = isUpgrade || isDowngrade;

  if (!isAllowed) {
    throw new Error("You cannot switch to this plan from your current plan. Please contact support.");
  }

  if (!user.stripeCustomerId) {
    throw new Error("Missing Stripe customer record. Please contact support.");
  }

  // Get active Stripe subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "active",
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    return startSubscriptionCheckout([{ priceId: targetPlan.stripePriceId, quantity: 1 }]);
  }

  const subscription = subscriptions.data[0];
  const subscriptionItem = subscription.items.data[0];

  if (isUpgrade) {
    // UPGRADE: Immediate change with proration, full credits granted immediately
    await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: subscriptionItem.id,
          price: targetPlan.stripePriceId,
        },
      ],
      proration_behavior: "always_invoice",
      billing_cycle_anchor: "unchanged",
      metadata: {
        clerkUserId: userId,
        changeType: "upgrade",
        targetPlanId: targetPlan.id,
      },
    });

    // The webhook will handle the immediate credit grant and plan update
    redirect("/billing?success=1&message=subscription-upgraded");
  } else {
    // DOWNGRADE: Defer until renewal, store in pending_plan_id
    await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: subscriptionItem.id,
          price: targetPlan.stripePriceId,
        },
      ],
      proration_behavior: "none",
      billing_cycle_anchor: "unchanged",
      metadata: {
        clerkUserId: userId,
        changeType: "downgrade",
        targetPlanId: targetPlan.id,
      },
    });

    // Store pending downgrade in user record
    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        pendingPlanId: targetPlan.id,
      },
    });

    redirect("/billing?success=1&message=subscription-downgrade-pending");
  }
}



