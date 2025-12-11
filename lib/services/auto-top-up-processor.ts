import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";
import { grantCreditsWithExpiry } from "@/lib/actions/credit-grant-with-expiry";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * Check if user needs auto top-up and process it
 * Called after credit deduction
 */
export async function checkAndProcessAutoTopUp(
  userId: string,
  newBalance: number
): Promise<{ processed: boolean; error?: string }> {
  try {
    // Get user with auto top-up preference
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        clerkId: true,
        autoTopUpEnabled: true,
        stripeCustomerId: true,
        creditBalance: true,
      },
    });

    if (!user || !user.autoTopUpEnabled) {
      return { processed: false };
    }

    // Get auto top-up settings
    const settings = await prisma.autoTopUpSettings.findFirst({
      where: { isActive: true },
      include: {
        topUpPlan: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!settings || !settings.topUpPlan) {
      console.warn("[AUTO_TOP_UP] No active settings or top-up plan configured");
      return { processed: false };
    }

    // Check if balance is at or below threshold
    // Use the admin-configured threshold instead of user's lowBalanceThreshold
    if (newBalance > settings.triggerThreshold) {
      return { processed: false };
    }

    // Check if user has Stripe customer ID
    if (!user.stripeCustomerId) {
      console.warn("[AUTO_TOP_UP] User has no Stripe customer ID, cannot process auto top-up");
      return { processed: false, error: "No Stripe customer ID" };
    }

    // Check if top-up plan has Stripe price ID
    if (!settings.topUpPlan.stripePriceId) {
      console.warn("[AUTO_TOP_UP] Top-up plan has no Stripe price ID");
      return { processed: false, error: "No Stripe price ID for top-up plan" };
    }

    // Check if we've already processed auto top-up recently (prevent duplicate charges)
    // Look for recent top-up purchases in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentTopUp = await prisma.topUpPurchase.findFirst({
      where: {
        userId: user.id,
        planId: settings.topUpPlan.id,
        purchasedAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentTopUp) {
      console.log("[AUTO_TOP_UP] Recent top-up found, skipping to prevent duplicate");
      return { processed: false, error: "Recent top-up already processed" };
    }

    console.log(`[AUTO_TOP_UP] Triggering auto top-up for user ${userId}: balance ${newBalance} <= threshold ${settings.triggerThreshold}`);

    // Try to charge saved payment method directly first (seamless auto top-up)
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (typeof customer === "object" && !customer.deleted) {
        const paymentMethods = await stripe.paymentMethods.list({
          customer: customer.id,
          type: "card",
        });

        const defaultPaymentMethod = paymentMethods.data.find(
          (pm) => pm.id === customer.invoice_settings?.default_payment_method
        ) || paymentMethods.data[0]; // Use default or first available

        if (defaultPaymentMethod) {
          // Charge saved payment method directly
          const amount = Math.round(settings.topUpPlan.priceUsd * 100); // Convert to cents

          const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            customer: user.stripeCustomerId,
            payment_method: defaultPaymentMethod.id,
            confirm: true,
            off_session: true, // Indicates customer is not present
            metadata: {
              clerkUserId: user.clerkId,
              autoTopUp: "true",
              triggerThreshold: String(settings.triggerThreshold),
              balanceBefore: String(newBalance),
              topUpPlanId: settings.topUpPlan.id,
            },
            return_url: `${process.env.NEXT_PUBLIC_SERVER_URL || "https://shoppablevideos.com"}/billing`,
          });

          if (paymentIntent.status === "succeeded") {
            console.log(`[AUTO_TOP_UP] Successfully charged saved payment method: ${paymentIntent.id}`);
            // Process the payment immediately
            const processResult = await processAutoTopUpPayment(
              `pi_${paymentIntent.id}`,
              user.clerkId
            );
            
            if (processResult.success) {
              return { processed: true };
            }
          } else if (paymentIntent.status === "requires_action") {
            // Payment requires authentication (3D Secure, etc.)
            // For auto top-up, we can't complete this without user interaction
            // Fall through to checkout session creation
            console.log(`[AUTO_TOP_UP] Payment requires action, falling back to checkout`);
          }
        }
      }
    } catch (paymentError: any) {
      // If charging saved payment method fails, fall back to checkout
      console.log(`[AUTO_TOP_UP] Failed to charge saved payment method, using checkout: ${paymentError.message}`);
    }

    // Fallback: Create Stripe checkout session (requires user interaction)
    // This handles cases where:
    // - No saved payment method
    // - Payment requires authentication
    // - Direct charge failed
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "https://shoppablevideos.com";
    const isDevelopment = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
    const successUrl = isDevelopment 
      ? `http://localhost:3000/billing?success=1&auto_top_up=1`
      : `${baseUrl}/billing?success=1&auto_top_up=1`;
    const cancelUrl = isDevelopment 
      ? `http://localhost:3000/billing?canceled=1&auto_top_up=1`
      : `${baseUrl}/billing?canceled=1&auto_top_up=1`;

    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: settings.topUpPlan.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        clerkUserId: user.clerkId,
        autoTopUp: "true",
        triggerThreshold: String(settings.triggerThreshold),
        balanceBefore: String(newBalance),
        topUpPlanId: settings.topUpPlan.id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: false,
    });

    console.log(`[AUTO_TOP_UP] Created Stripe checkout session: ${session.id} (user interaction required)`);
    // Note: User will need to complete checkout manually
    // In the future, we could send them an email notification

    return { processed: true };
  } catch (error: any) {
    console.error("[AUTO_TOP_UP] Error processing auto top-up:", error);
    return { processed: false, error: error.message || "Failed to process auto top-up" };
  }
}

/**
 * Process auto top-up after successful Stripe payment
 * Called from webhook or after successful checkout
 * Supports both checkout sessions and payment intents
 */
export async function processAutoTopUpPayment(
  sessionIdOrPaymentIntentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let metadata: Record<string, string> = {};
    let amount = 0;
    let customerId: string | null = null;

    // Check if it's a payment intent ID or session ID
    if (sessionIdOrPaymentIntentId.startsWith("pi_")) {
      // Payment Intent
      const paymentIntent = await stripe.paymentIntents.retrieve(sessionIdOrPaymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return { success: false, error: "Payment not completed" };
      }
      metadata = paymentIntent.metadata as Record<string, string>;
      amount = paymentIntent.amount;
      customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id || null;
    } else {
      // Checkout Session
      const session = await stripe.checkout.sessions.retrieve(sessionIdOrPaymentIntentId, {
        expand: ["payment_intent"],
      });

      if (session.payment_status !== "paid") {
        return { success: false, error: "Payment not completed" };
      }
      metadata = session.metadata as Record<string, string>;
      amount = session.amount_total || 0;
      customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
    }

    const topUpPlanId = metadata?.topUpPlanId;
    if (!topUpPlanId) {
      return { success: false, error: "No top-up plan ID in metadata" };
    }

    const topUpPlan = await prisma.topUpPlan.findUnique({
      where: { id: topUpPlanId },
    });

    if (!topUpPlan) {
      return { success: false, error: "Top-up plan not found" };
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Create top-up purchase record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + topUpPlan.creditExpiryDays);

    const isPaymentIntent = sessionIdOrPaymentIntentId.startsWith("pi_");
    const purchaseData: any = {
      userId: user.id,
      planId: topUpPlan.id,
      amount: topUpPlan.priceUsd,
      creditsGranted: topUpPlan.creditsGranted,
      expiresAt,
    };

    if (isPaymentIntent) {
      purchaseData.stripeInvoiceId = sessionIdOrPaymentIntentId; // Store payment intent ID in invoice field for now
    } else {
      purchaseData.stripeSessionId = sessionIdOrPaymentIntentId;
    }

    const purchase = await prisma.topUpPurchase.create({
      data: purchaseData,
    });

    // Grant credits with expiry
    const idempotencyKey = `auto_top_up:${sessionIdOrPaymentIntentId}`;
    const grantResult = await grantCreditsWithExpiry({
      userId: user.clerkId,
      type: "TOPUP",
      amount: topUpPlan.creditsGranted,
      expiresAt,
      reason: `Auto top-up: ${topUpPlan.publicName}`,
      planId: topUpPlan.id,
      idempotencyKey,
      metadata: {
        purchaseId: purchase.id,
        paymentId: sessionIdOrPaymentIntentId,
        autoTopUp: true,
        triggerThreshold: metadata?.triggerThreshold,
        balanceBefore: metadata?.balanceBefore,
      },
    });

    console.log(`[AUTO_TOP_UP] Successfully processed auto top-up for user ${userId}: ${topUpPlan.creditsGranted} credits granted`);

    return { success: true };
  } catch (error: any) {
    console.error("[AUTO_TOP_UP] Error processing payment:", error);
    return { success: false, error: error.message || "Failed to process payment" };
  }
}

