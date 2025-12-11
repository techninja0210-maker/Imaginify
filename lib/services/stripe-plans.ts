/**
 * Stripe Plans Service
 * 
 * Helper functions to find or create subscription/top-up plans from Stripe
 */

import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * Find or create a SubscriptionPlan from Stripe price
 */
export async function findOrCreateSubscriptionPlan(stripePriceId: string): Promise<{ id: string }> {
  // Try to find existing plan
  const existing = await prisma.subscriptionPlan.findUnique({
    where: { stripePriceId }
  });

  if (existing) {
    return { id: existing.id };
  }

  // Fetch from Stripe
  const price = await stripe.prices.retrieve(stripePriceId);
  const product = await stripe.products.retrieve(price.product as string);

  if (price.type !== "recurring") {
    throw new Error(`Price ${stripePriceId} is not a recurring subscription`);
  }

  // Extract metadata
  const credits = Number((price.metadata as any)?.credits || product.metadata?.credits || 0);
  const planFamily = (price.metadata as any)?.planFamily || product.metadata?.planFamily || "basic";
  const version = Number((price.metadata as any)?.version || product.metadata?.version || 1);
  const internalId = (price.metadata as any)?.internalId || product.metadata?.internalId || `sub_${planFamily}_v${version}`;
  const publicName = (price.metadata as any)?.publicName || product.name || `${planFamily} Plan`;

  // Validate credits are configured
  if (!credits || credits <= 0) {
    console.error(`[STRIPE_PLANS] ⚠️  WARNING: Subscription plan ${publicName} (price ${priceId}) has no credits configured in Stripe metadata.`);
    console.error(`[STRIPE_PLANS] Please add 'credits' metadata to Stripe price ${priceId} or product ${product.id}`);
    console.error(`[STRIPE_PLANS] Price metadata:`, price.metadata);
    console.error(`[STRIPE_PLANS] Product metadata:`, product.metadata);
    // Don't throw - allow plan creation but log warning
    // The webhook will catch this and provide a better error message
  }

  // Create plan
  const plan = await prisma.subscriptionPlan.create({
    data: {
      planFamily,
      version,
      internalId,
      publicName,
      priceUsd: price.unit_amount ? price.unit_amount / 100 : 0,
      creditsPerCycle: credits,
      creditExpiryDays: 30, // Default for subscriptions
      stripePriceId: price.id,
      stripeProductId: product.id,
      isActiveForNewSignups: true,
      isLegacyOnly: false,
      isHidden: false,
      isDefaultForSignup: false,
    }
  });

  return { id: plan.id };
}

/**
 * Find or create a TopUpPlan from Stripe price
 */
export async function findOrCreateTopUpPlan(stripePriceId: string): Promise<{ id: string }> {
  // Try to find existing plan
  const existing = await prisma.topUpPlan.findUnique({
    where: { stripePriceId }
  });

  if (existing) {
    return { id: existing.id };
  }

  // Fetch from Stripe
  const price = await stripe.prices.retrieve(stripePriceId);
  const product = await stripe.products.retrieve(price.product as string);

  if (price.type === "recurring") {
    throw new Error(`Price ${stripePriceId} is a recurring subscription, not a top-up`);
  }

  // Extract metadata
  const credits = Number((price.metadata as any)?.credits || product.metadata?.credits || 0);
  const version = Number((price.metadata as any)?.version || product.metadata?.version || 1);
  const internalId = (price.metadata as any)?.internalId || product.metadata?.internalId || `topup_${credits}_v${version}`;
  const publicName = (price.metadata as any)?.publicName || product.name || `${credits} Credit Boost`;

  // Create plan
  const plan = await prisma.topUpPlan.create({
    data: {
      internalId,
      publicName,
      priceUsd: price.unit_amount ? price.unit_amount / 100 : 0,
      creditsGranted: credits,
      creditExpiryDays: 365, // Default for top-ups
      stripePriceId: price.id,
      stripeProductId: product.id,
      canPurchaseWithoutSubscription: true,
      isActive: true,
      isHidden: false,
    }
  });

  return { id: plan.id };
}

