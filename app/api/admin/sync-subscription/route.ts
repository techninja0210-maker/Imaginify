import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAdmin } from '@/lib/auth/admin-auth';
import { grantCreditsWithExpiry } from '@/lib/actions/credit-grant-with-expiry';
import { findOrCreateSubscriptionPlan } from '@/lib/services/stripe-plans';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sync-subscription
 * Admin endpoint to manually sync a subscription from Stripe and grant credits
 * 
 * Body: { email?: string, customerId?: string, subscriptionId?: string }
 * If no parameters, syncs all active subscriptions
 */
export async function POST(req: NextRequest) {
  try {
    // Require admin access
    await requireAdmin();
    
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({
        error: 'Stripe not configured'
      }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = await req.json();
    const { email, customerId, subscriptionId } = body;

    const results = [];

    // If subscriptionId provided, sync that specific subscription
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const result = await syncSingleSubscription(stripe, subscription);
        results.push(result);
      } catch (error: any) {
        return NextResponse.json({
          error: `Failed to sync subscription ${subscriptionId}`,
          details: error.message
        }, { status: 500 });
      }
    }
    // If email or customerId provided, find and sync their subscription
    else if (email || customerId) {
      let user;
      let stripeCustomerId = customerId;

      if (email) {
        user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, clerkId: true, stripeCustomerId: true, email: true }
        });

        if (!user) {
          return NextResponse.json({
            error: `User not found with email: ${email}`
          }, { status: 404 });
        }

        stripeCustomerId = user.stripeCustomerId || customerId;
      } else if (customerId) {
        user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true, clerkId: true, stripeCustomerId: true, email: true }
        });
      }

      if (!stripeCustomerId) {
        return NextResponse.json({
          error: 'No Stripe customer ID found for user'
        }, { status: 400 });
      }

      if (!user) {
        return NextResponse.json({
          error: 'User not found'
        }, { status: 404 });
      }

      // Get active subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
        limit: 10
      });

      if (subscriptions.data.length === 0) {
        return NextResponse.json({
          error: 'No active subscriptions found for this customer',
          customerId: stripeCustomerId,
          email: user.email
        }, { status: 404 });
      }

      for (const subscription of subscriptions.data) {
        const result = await syncSingleSubscription(stripe, subscription, user);
        results.push(result);
      }
    }
    // No parameters - sync all active subscriptions (last 100)
    else {
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100
      });

      for (const subscription of subscriptions.data) {
        try {
          const result = await syncSingleSubscription(stripe, subscription);
          results.push(result);
        } catch (error: any) {
          results.push({
            subscriptionId: subscription.id,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        success: successCount,
        skipped: skippedCount,
        errors: errorCount
      },
      results
    });

  } catch (error: any) {
    console.error('[SYNC_SUBSCRIPTION] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

async function syncSingleSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  user?: { id: string; clerkId: string; email: string }
) {
  const stripeSubscriptionId = subscription.id;
  const customerId = subscription.customer as string;
  const status = subscription.status;
  const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;

  try {
    // Find user if not provided
    if (!user) {
      let foundUser = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId }
      });

      if (!foundUser) {
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
        if (email) {
          foundUser = await prisma.user.findUnique({
            where: { email }
          });
          if (foundUser && !foundUser.stripeCustomerId) {
            await prisma.user.update({
              where: { id: foundUser.id },
              data: { stripeCustomerId: customerId }
            });
          }
        }
      }

      if (!foundUser) {
        return {
          subscriptionId: stripeSubscriptionId,
          status: 'error',
          error: `User not found for customer ${customerId}`
        };
      }

      user = {
        id: foundUser.id,
        clerkId: foundUser.clerkId,
        email: foundUser.email
      };
    }

    if (!priceId) {
      return {
        subscriptionId: stripeSubscriptionId,
        status: 'error',
        error: 'No price ID found in subscription'
      };
    }

    // Find or create subscription plan
    const planResult = await findOrCreateSubscriptionPlan(priceId);
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planResult.id }
    });

    if (!plan) {
      return {
        subscriptionId: stripeSubscriptionId,
        status: 'error',
        error: `Failed to find subscription plan for price ${priceId}`
      };
    }

    // Map Stripe status to our enum
    let subscriptionStatus: "ACTIVE" | "CANCELED" | "PAST_DUE" | "UNPAID" | "TRIALING" = "ACTIVE";
    if (status === "canceled") subscriptionStatus = "CANCELED";
    else if (status === "past_due") subscriptionStatus = "PAST_DUE";
    else if (status === "unpaid") subscriptionStatus = "UNPAID";
    else if (status === "trialing") subscriptionStatus = "TRIALING";
    else if (status === "active") subscriptionStatus = "ACTIVE";

    // Get subscription period dates
    const currentPeriodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000)
      : new Date();
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Check if subscription already exists
    const existingSubscription = await prisma.userSubscription.findUnique({
      where: { stripeSubscriptionId }
    });

    let creditsGranted = false;

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

    // If subscription is active, check if credits need to be granted
    if (subscriptionStatus === "ACTIVE") {
      // Check if credits were already granted for the CURRENT plan in this period
      const existingGrantForCurrentPlan = await prisma.creditGrant.findFirst({
        where: {
          userId: user.id,
          subscriptionId: userSubscription.id,
          planId: plan.id, // Check for current plan's credits
          type: "SUBSCRIPTION",
          createdAt: {
            gte: currentPeriodStart
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Also check if there's a grant for the old plan (for upgrades)
      const existingGrantForAnyPlan = await prisma.creditGrant.findFirst({
        where: {
          userId: user.id,
          subscriptionId: userSubscription.id,
          type: "SUBSCRIPTION",
          createdAt: {
            gte: currentPeriodStart
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // If no grant exists for current plan, or if there's a grant for a different (old) plan, grant credits
      const needsCredits = !existingGrantForCurrentPlan || 
                          (existingGrantForAnyPlan && existingGrantForAnyPlan.planId !== plan.id);

      if (needsCredits) {
        // Check if this is an upgrade by fetching the old plan if it exists
        let isUpgrade = false;
        if (existingGrantForAnyPlan && existingGrantForAnyPlan.planId && existingGrantForAnyPlan.planId !== plan.id) {
          const oldPlan = await prisma.subscriptionPlan.findUnique({
            where: { id: existingGrantForAnyPlan.planId },
            select: { creditsPerCycle: true }
          });
          if (oldPlan && plan.creditsPerCycle > oldPlan.creditsPerCycle) {
            isUpgrade = true;
          }
        }
        const isNewOrRenewal = !existingGrantForAnyPlan;
        
        const reason = isUpgrade
          ? `Admin sync: Subscription upgrade to ${plan.publicName} - credit grant`
          : isNewOrRenewal
          ? `Admin sync: Subscription credit grant for ${plan.publicName}`
          : `Admin sync: Plan change credit grant for ${plan.publicName}`;

        // Grant credits for the subscription
        const expiresAt = new Date(currentPeriodEnd);
        expiresAt.setDate(expiresAt.getDate() + plan.creditExpiryDays);

        await grantCreditsWithExpiry({
          userId: user.clerkId,
          type: "SUBSCRIPTION",
          amount: plan.creditsPerCycle,
          expiresAt,
          reason,
          planId: plan.id,
          subscriptionId: userSubscription.id,
          idempotencyKey: `admin:sync:${stripeSubscriptionId}:${Date.now()}`,
          metadata: {
            stripeSubscriptionId,
            planName: plan.publicName,
            periodEnd: currentPeriodEnd.toISOString(),
            periodStart: currentPeriodStart.toISOString(),
            syncedByAdmin: true,
            isUpgrade: isUpgrade || false,
            previousPlanId: existingGrantForAnyPlan?.planId || null,
          }
        });

        creditsGranted = true;
        
        console.log(`[SYNC_SUBSCRIPTION] ✅ Granted ${plan.creditsPerCycle} credits for plan ${plan.publicName}${isUpgrade ? ' (upgrade)' : ''}`);
        
        // Revalidate pages to show updated credits immediately
        revalidatePath('/');
        revalidatePath('/profile');
        revalidatePath('/billing');
        revalidatePath('/credits');
      } else {
        console.log(`[SYNC_SUBSCRIPTION] Credits already granted for plan ${plan.publicName} in period ${currentPeriodStart.toISOString()}`);
      }
    }

    return {
      subscriptionId: stripeSubscriptionId,
      status: 'success',
      email: user.email,
      planName: plan.publicName,
      creditsPerCycle: plan.creditsPerCycle,
      creditsGranted,
      subscriptionStatus,
      periodEnd: currentPeriodEnd.toISOString(),
      message: existingSubscription ? 'Subscription updated' : 'Subscription created'
    };

  } catch (error: any) {
    console.error(`[SYNC_SUBSCRIPTION] Error syncing subscription ${stripeSubscriptionId}:`, error);
    return {
      subscriptionId: stripeSubscriptionId,
      status: 'error',
      error: error.message
    };
  }
}

