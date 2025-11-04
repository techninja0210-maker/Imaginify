"use server";

import Stripe from "stripe";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export async function startSubscriptionCheckout(
  lineItems: Array<{ priceId: string; quantity: number }>,
  rewardfulReferral?: string
) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const metadata: Record<string, string> = {
    clerkUserId: userId,
  };

  // Add Rewardful referral if provided
  if (rewardfulReferral) {
    metadata.rewardful_referral = rewardfulReferral;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems.map(item => ({
      price: item.priceId,
      quantity: item.quantity,
    })),
    metadata,
    success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/pricing`,
  });

  redirect(session.url!);
}

export async function openCustomerPortal(customerId: string) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/billing`,
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

export async function changeSubscription(priceId: string) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const prisma = (await import('@/lib/database/prisma')).prisma;

  // Get user
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { stripeCustomerId: true },
  });

  if (!user || !user.stripeCustomerId) {
    throw new Error("No Stripe customer found. Please link your billing account first.");
  }

  // Get active subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: "active",
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    // No active subscription, create new one
    return startSubscriptionCheckout([{ priceId, quantity: 1 }]);
  }

  const subscription = subscriptions.data[0];
  const subscriptionItem = subscription.items.data[0];

  // Update subscription to new price
  await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscriptionItem.id,
        price: priceId,
      },
    ],
    proration_behavior: "always_invoice", // Prorate immediately
    metadata: {
      clerkUserId: userId,
    },
  });

  redirect("/billing?success=1&message=subscription-updated");
}



