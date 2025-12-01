/* eslint-disable camelcase */
import { createTransaction } from "@/lib/actions/transaction.action";
import { updateCredits, getUserOrganizationId } from "@/lib/actions/user.actions";
import { grantCreditsWithExpiry } from "@/lib/actions/credit-grant-with-expiry";
import { findOrCreateTopUpPlan, findOrCreateSubscriptionPlan } from "@/lib/services/stripe-plans";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { revalidatePath } from "next/cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(request: Request) {
  const body = await request.text();

  const sig = request.headers.get("stripe-signature") as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    return NextResponse.json({ message: "Webhook error", error: err });
  }

  // Get the ID and type
  const eventType = event.type;

  // One-time top-up checkout
  if (eventType === "checkout.session.completed") {
    const { id, amount_total, metadata } = event.data.object as any;
    const customerId = (event.data.object as any).customer as string | null;

    const transaction = {
      stripeId: id,
      amount: amount_total ? amount_total / 100 : 0,
      plan: metadata?.plan || "",
      credits: Number(metadata?.credits) || 0,
      buyerId: metadata?.clerkUserId || metadata?.buyerId || "",
      createdAt: new Date(),
    };

    // Persist Stripe customer ID on the user for future billing portal access
    try {
      const clerkUserId = metadata?.clerkUserId || metadata?.buyerId;
      if (clerkUserId && customerId) {
        await prisma.user.update({
          where: { clerkId: clerkUserId },
          data: { stripeCustomerId: customerId }
        });
      }
    } catch (e) {
      // no-op: we still record the transaction
    }

    let newTransaction;
    try {
      newTransaction = await createTransaction(transaction);
    } catch (txError: any) {
      console.error('Transaction creation failed in webhook:', txError);
      // Continue to grant credits even if transaction record fails
    }

    // Grant purchased credits to the user using idempotency
    // Use same idempotency key format as confirm endpoint: stripe:session:${sessionId}
    if (transaction.buyerId && typeof transaction.buyerId === 'string' && transaction.credits > 0) {
      try {
        // Verify user exists before attempting to grant credits
        const userExists = await prisma.user.findUnique({
          where: { clerkId: transaction.buyerId },
          select: { id: true }
        });

        if (!userExists) {
          console.error(`[WEBHOOK] User not found: ${transaction.buyerId}`);
          return NextResponse.json({ 
            message: "User not found", 
            transaction: newTransaction,
            error: `User ${transaction.buyerId} does not exist`,
            buyerId: transaction.buyerId
          }, { status: 404 });
        }

        const idemKey = `stripe:session:${transaction.stripeId}`;
        // Check if already processed (prevent double-grant if confirm endpoint already handled it)
        const existingLedger = await prisma.creditLedger.findUnique({
          where: { idempotencyKey: idemKey }
        });
        
        if (existingLedger) {
          console.log(`Credits already granted for session ${transaction.stripeId} (idempotency check)`);
          return NextResponse.json({ 
            message: "OK", 
            transaction: newTransaction,
            skipped: true,
            reason: 'Already processed'
          });
        }

        // NEW: Use grant system for top-up purchases
        // Get session to find price ID (expand line_items)
        const session = await stripe.checkout.sessions.retrieve(transaction.stripeId, {
          expand: ['line_items']
        });
        const priceId = session.line_items?.data?.[0]?.price?.id as string | undefined;

        if (!priceId) {
          // Fallback to old method if no price ID
          const creditResult = await updateCredits(
            transaction.buyerId, 
            transaction.credits, 
            `Top-up purchase ${transaction.stripeId}`, 
            idemKey
          );
          
          if (!creditResult) {
            console.error(`[WEBHOOK] updateCredits returned null/undefined for session ${transaction.stripeId}`);
            throw new Error('updateCredits returned null/undefined');
          }
        } else {
          // Find or create top-up plan
          const planResult = await findOrCreateTopUpPlan(priceId);
          const plan = await prisma.topUpPlan.findUnique({
            where: { id: planResult.id }
          });

          if (!plan) {
            throw new Error(`Failed to find or create top-up plan for price ${priceId}`);
          }

          // Create top-up purchase record
          const user = await prisma.user.findUnique({
            where: { clerkId: transaction.buyerId }
          });

          if (!user) {
            throw new Error(`User not found: ${transaction.buyerId}`);
          }

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + plan.creditExpiryDays);

          const topUpPurchase = await prisma.topUpPurchase.create({
            data: {
              userId: user.id,
              planId: plan.id,
              stripeSessionId: transaction.stripeId,
              amount: transaction.amount,
              creditsGranted: transaction.credits,
              expiresAt,
            }
          });

          // Grant credits with expiry
          await grantCreditsWithExpiry({
            userId: transaction.buyerId,
            type: "TOPUP",
            amount: transaction.credits,
            expiresAt,
            reason: `Top-up purchase ${transaction.stripeId}`,
            planId: plan.id,
            topUpPurchaseId: topUpPurchase.id,
            idempotencyKey: idemKey,
            metadata: {
              stripeSessionId: transaction.stripeId,
              planName: plan.publicName,
            }
          });

          console.log(`[WEBHOOK] Top-up credits granted with expiry: ${transaction.credits} credits, expires ${expiresAt.toISOString()}`);
        }
        
        // Verify credits were actually added
        const verifyUser = await prisma.user.findUnique({
          where: { clerkId: transaction.buyerId },
          select: { creditBalance: true }
        });
        
        console.log(`[WEBHOOK] Credits granted via webhook: ${transaction.credits} to ${transaction.buyerId}, new balance: ${verifyUser?.creditBalance || 'unknown'}`);
        
        // Revalidate all pages to show updated credits immediately
        revalidatePath('/');
        revalidatePath('/profile');
        revalidatePath('/billing');
        revalidatePath('/credits');
        
        return NextResponse.json({ 
          message: "OK", 
          transaction: newTransaction,
          creditsGranted: transaction.credits,
          newBalance: verifyUser?.creditBalance || null
        });
      } catch (creditError: any) {
        console.error('Credit grant failed in webhook:', creditError);
        // Return error but don't fail webhook completely (Stripe will retry)
        return NextResponse.json({ 
          message: "Transaction recorded but credit grant failed", 
          error: creditError?.message,
          transaction: newTransaction
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ message: "OK", transaction: newTransaction });
  }

  // Stamp invoice metadata early so downstream paid handler is robust
  if (eventType === "invoice.created") {
    const invoice = event.data.object as any;
    try {
      // Resolve clerkUserId by customer → user
      let clerkUserId: string | undefined = invoice.metadata?.clerkUserId;
      if (!clerkUserId && invoice.customer) {
        const customerId = invoice.customer as string;
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user) clerkUserId = user.clerkId;
      }

      // Resolve planCredits from price → your price book or price metadata
      let planCredits = Number(invoice.metadata?.planCredits || 0);
      if (!planCredits && invoice.lines?.data?.length) {
        const priceId = invoice.lines.data[0]?.price?.id as string | undefined;
        if (priceId) {
          // Try price metadata first
          const price = await stripe.prices.retrieve(priceId);
          const metaCredits = Number((price.metadata as any)?.credits || 0);
          if (metaCredits > 0) planCredits = metaCredits;
        }
      }

      // Stamp metadata if we resolved anything
      const meta: any = { ...(invoice.metadata || {}) };
      if (clerkUserId) meta.clerkUserId = clerkUserId;
      if (planCredits) meta.planCredits = String(planCredits);
      if (Object.keys(meta).length) {
        await stripe.invoices.update(invoice.id, { metadata: meta });
      }
    } catch {
      // swallow, continue to other handlers
    }
    return new Response("", { status: 200 });
  }

  // Handle subscription creation/updates
  if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
    const subscription = event.data.object as any;
    const customerId = subscription.customer as string;
    const stripeSubscriptionId = subscription.id;
    const status = subscription.status; // active, canceled, past_due, unpaid, trialing
    const changeType = subscription.metadata?.changeType as string | undefined; // "upgrade" or "downgrade"
    const targetPlanId = subscription.metadata?.targetPlanId as string | undefined;
    
    try {
      // Find user by Stripe customer ID
      let user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      // Fallback: map by email
      if (!user) {
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
        if (email) {
          user = await prisma.user.findFirst({ where: { email } });
          if (user) {
            await prisma.user.update({ where: { clerkId: user.clerkId }, data: { stripeCustomerId: customerId } });
          }
        }
      }
      
      if (user) {
        console.log(`[WEBHOOK] Subscription ${eventType} for user ${user.clerkId}, status: ${status}, changeType: ${changeType}`);
        
        // Get price ID from subscription
        const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
        
        if (priceId) {
          // Find or create subscription plan
          const planResult = await findOrCreateSubscriptionPlan(priceId);
          const plan = await prisma.subscriptionPlan.findUnique({
            where: { id: planResult.id }
          });

          if (plan) {
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
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

            // Get existing subscription to compare plans
            const existingSubscription = await prisma.userSubscription.findUnique({
              where: { stripeSubscriptionId },
              include: { plan: true }
            });

            // Update or create UserSubscription
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

            console.log(`[WEBHOOK] UserSubscription ${eventType === "customer.subscription.created" ? "created" : "updated"}: ${userSubscription.id}, plan: ${plan.publicName}, status: ${subscriptionStatus}`);

            // Handle IMMEDIATE CANCELLATION: Disable entitlements if canceled immediately
            const isImmediateCancel = status === "canceled" && !subscription.cancel_at_period_end;
            if (isImmediateCancel) {
              console.log(`[WEBHOOK] Immediate cancellation detected: disabling entitlements for user ${user.clerkId}`);
              // Subscription is canceled immediately - disable entitlements
              // The subscription status is already set to CANCELED above
              // Clear pending downgrades since subscription is ending
              await prisma.user.update({
                where: { clerkId: user.clerkId },
                data: {
                  pendingPlanId: null,
                }
              });
            }

            // Handle UPGRADE: Grant full monthly credits immediately (not prorated)
            // Detect upgrade by metadata or by comparing plan prices
            const isUpgrade = changeType === "upgrade" || 
              (existingSubscription && existingSubscription.plan && plan.priceUsd > existingSubscription.plan.priceUsd);
            const isPlanChange = existingSubscription && existingSubscription.planId !== plan.id;
            
            if (eventType === "customer.subscription.updated" && isUpgrade && status === "active" && isPlanChange) {
                console.log(`[WEBHOOK] Processing upgrade: granting full monthly credits for plan ${plan.publicName}`);
                
                try {
                  // Grant full monthly credit allowance immediately
                  const expiresAt = new Date(currentPeriodEnd);
                  expiresAt.setDate(expiresAt.getDate() + plan.creditExpiryDays);

                  await grantCreditsWithExpiry({
                    userId: user.clerkId,
                    type: "SUBSCRIPTION",
                    amount: plan.creditsPerCycle,
                    expiresAt,
                    reason: `Subscription upgrade to ${plan.publicName} - full monthly allowance`,
                    planId: plan.id,
                    subscriptionId: userSubscription.id,
                    idempotencyKey: `stripe:subscription:upgrade:${stripeSubscriptionId}:${Date.now()}`,
                    metadata: {
                      stripeSubscriptionId,
                      planName: plan.publicName,
                      changeType: "upgrade",
                      fullMonthlyAllowance: true,
                    }
                  });

                  // Update user's plan immediately for upgrades
                  await prisma.user.update({
                    where: { clerkId: user.clerkId },
                    data: {
                      pendingPlanId: null, // Clear any pending downgrade
                    }
                  });

                  console.log(`[WEBHOOK] Upgrade complete: granted ${plan.creditsPerCycle} credits for plan ${plan.publicName}`);
                } catch (upgradeError: any) {
                  console.error(`[WEBHOOK] Error granting upgrade credits:`, upgradeError);
                  // Don't fail the webhook, but log the error
                }
            }

            // Handle DOWNGRADE: Store in pending_plan_id (already done in changeSubscriptionPlan, but ensure it's set)
            // Detect downgrade by metadata or by comparing plan prices
            const isDowngrade = changeType === "downgrade" || 
              (existingSubscription && existingSubscription.plan && plan.priceUsd < existingSubscription.plan.priceUsd);
            
            if (eventType === "customer.subscription.updated" && isDowngrade && status === "active" && isPlanChange) {
              // Use targetPlanId from metadata, or fallback to current plan ID
              const planIdToStore = targetPlanId || plan.id;
              
              // Only update if not already set (avoid race conditions)
              const currentUser = await prisma.user.findUnique({
                where: { clerkId: user.clerkId },
                select: { pendingPlanId: true }
              });
              
              if (!currentUser?.pendingPlanId) {
                await prisma.user.update({
                  where: { clerkId: user.clerkId },
                  data: {
                    pendingPlanId: planIdToStore,
                  }
                });
                console.log(`[WEBHOOK] Downgrade pending: stored plan ${planIdToStore} in pending_plan_id, will finalize at renewal`);
              } else {
                console.log(`[WEBHOOK] Downgrade already pending: plan ${currentUser.pendingPlanId} in pending_plan_id`);
              }
            }
          } else {
            console.error(`[WEBHOOK] Failed to find subscription plan for price ${priceId}`);
          }
        } else {
          console.warn(`[WEBHOOK] No price ID found in subscription ${stripeSubscriptionId}`);
        }
      } else {
        console.warn(`[WEBHOOK] User not found for customer ${customerId}`);
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error handling subscription ${eventType}:`, error);
    }
    
    return NextResponse.json({ ok: true });
  }

  // Subscription renewal/start via invoice.paid
  if (eventType === "invoice.paid") {
    const invoice = event.data.object as any;
    const subscriptionId = invoice.subscription as string;
    let clerkUserId = invoice.metadata?.clerkUserId as string | undefined;
    let planCredits = Number(invoice.metadata?.planCredits || 0);

    // Fallbacks if metadata is missing
    if (!clerkUserId && invoice.customer) {
      const customerId = invoice.customer as string;
      let user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
      if (!user) {
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
        if (email) {
          user = await prisma.user.findFirst({ where: { email } });
          if (user) {
            await prisma.user.update({ where: { clerkId: user.clerkId }, data: { stripeCustomerId: customerId } });
          }
        }
      }
      if (user) clerkUserId = user.clerkId;
    }
    if (!planCredits && invoice.lines?.data?.length) {
      try {
        const priceId = invoice.lines.data[0]?.price?.id as string | undefined;
        if (priceId) {
          const price = await stripe.prices.retrieve(priceId);
          const metaCredits = Number((price.metadata as any)?.credits || 0);
          if (metaCredits > 0) planCredits = metaCredits;
        }
      } catch {}
    }

    if (clerkUserId && typeof clerkUserId === 'string' && planCredits > 0) {
      // NEW: Use grant system for subscription renewals
      const priceId = invoice.lines?.data?.[0]?.price?.id as string | undefined;

      if (priceId) {
        try {
          // Find or create subscription plan
          const planResult = await findOrCreateSubscriptionPlan(priceId);
          const plan = await prisma.subscriptionPlan.findUnique({
            where: { id: planResult.id }
          });

          if (!plan) {
            throw new Error(`Failed to find or create subscription plan for price ${priceId}`);
          }

          // Get user with pending_plan_id check
          const user = await prisma.user.findUnique({
            where: { clerkId: clerkUserId },
            select: {
              id: true,
              pendingPlanId: true,
            }
          });

          if (!user) {
            throw new Error(`User not found: ${clerkUserId}`);
          }

          // CHECK FOR PENDING DOWNGRADE: Finalize at renewal
          let finalPlan = plan;
          let finalPlanCredits = planCredits;
          const hadPendingDowngrade = !!user.pendingPlanId;
          
          if (user.pendingPlanId) {
            // There's a pending downgrade - finalize it at renewal
            const pendingPlan = await prisma.subscriptionPlan.findUnique({
              where: { id: user.pendingPlanId }
            });

            if (pendingPlan) {
              // Use the pending plan (lower plan) for credits and entitlements
              finalPlan = pendingPlan;
              finalPlanCredits = pendingPlan.creditsPerCycle;

              console.log(`[WEBHOOK] Finalizing downgrade at renewal: granting credits for ${pendingPlan.publicName} (${finalPlanCredits} credits)`);

              // Clear pending_plan_id - downgrade is now finalized
              await prisma.user.update({
                where: { clerkId: clerkUserId },
                data: {
                  pendingPlanId: null,
                }
              });

              console.log(`[WEBHOOK] Downgrade finalized: credits granted for ${pendingPlan.publicName}, pending_plan_id cleared`);
            } else {
              console.error(`[WEBHOOK] Pending plan ${user.pendingPlanId} not found, using current plan`);
              // Clear invalid pending plan ID
              await prisma.user.update({
                where: { clerkId: clerkUserId },
                data: {
                  pendingPlanId: null,
                }
              });
            }
          }

          let userSubscription = await prisma.userSubscription.findUnique({
            where: { stripeSubscriptionId: subscriptionId }
          });

          if (!userSubscription) {
            // Create new subscription record
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            userSubscription = await prisma.userSubscription.create({
              data: {
                userId: user.id,
                planId: finalPlan.id,
                stripeSubscriptionId: subscriptionId,
                status: subscription.status === "active" ? "ACTIVE" : 
                        subscription.status === "canceled" ? "CANCELED" :
                        subscription.status === "past_due" ? "PAST_DUE" :
                        subscription.status === "unpaid" ? "UNPAID" : "ACTIVE",
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              }
            });
          } else {
            // Update existing subscription to use final plan (may be downgraded)
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            userSubscription = await prisma.userSubscription.update({
              where: { id: userSubscription.id },
              data: {
                planId: finalPlan.id,
                status: subscription.status === "active" ? "ACTIVE" : 
                        subscription.status === "canceled" ? "CANCELED" :
                        subscription.status === "past_due" ? "PAST_DUE" :
                        subscription.status === "unpaid" ? "UNPAID" : "ACTIVE",
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              }
            });
          }

          // Grant credits for the final plan (may be downgraded plan)
          const expiresAt = new Date(userSubscription.currentPeriodEnd);
          expiresAt.setDate(expiresAt.getDate() + finalPlan.creditExpiryDays);

          await grantCreditsWithExpiry({
            userId: clerkUserId,
            type: "SUBSCRIPTION",
            amount: finalPlanCredits,
            expiresAt,
            reason: `Subscription credit grant ${subscriptionId}${hadPendingDowngrade ? ' (downgrade finalized)' : ''}`,
            planId: finalPlan.id,
            subscriptionId: userSubscription.id,
            idempotencyKey: `stripe:invoice:${invoice.id}`,
            metadata: {
              stripeInvoiceId: invoice.id,
              stripeSubscriptionId: subscriptionId,
              planName: finalPlan.publicName,
              periodEnd: userSubscription.currentPeriodEnd.toISOString(),
              downgradeFinalized: hadPendingDowngrade,
            }
          });

          console.log(`[WEBHOOK] Subscription credits granted: ${finalPlanCredits} credits for plan ${finalPlan.publicName}, expires ${expiresAt.toISOString()}`);
        } catch (error: any) {
          console.error(`[WEBHOOK] Failed to grant subscription credits with expiry, falling back to old method:`, error);
          // Fallback to old method
          await updateCredits(clerkUserId, planCredits, `Subscription credit grant ${subscriptionId}`, `stripe:invoice:${invoice.id}`);
        }
      } else {
        // Fallback to old method if no price ID
        await updateCredits(clerkUserId, planCredits, `Subscription credit grant ${subscriptionId}`, `stripe:invoice:${invoice.id}`);
      }
    }

    return NextResponse.json({ ok: true });
  }

  // Handle subscription deletion
  if (eventType === "customer.subscription.deleted") {
    const subscription = event.data.object as any;
    const stripeSubscriptionId = subscription.id;
    
    try {
      const userSubscription = await prisma.userSubscription.findUnique({
        where: { stripeSubscriptionId }
      });

      if (userSubscription) {
        // Update status to CANCELED instead of deleting (preserve history)
        await prisma.userSubscription.update({
          where: { stripeSubscriptionId },
          data: {
            status: "CANCELED",
            canceledAt: new Date(),
            cancelAtPeriodEnd: false,
          }
        });

        console.log(`[WEBHOOK] Subscription deleted: ${stripeSubscriptionId}, marked as CANCELED`);
      } else {
        console.warn(`[WEBHOOK] UserSubscription not found for deleted subscription ${stripeSubscriptionId}`);
      }
    } catch (error) {
      console.error(`[WEBHOOK] Error handling subscription deletion:`, error);
    }
    
    return NextResponse.json({ ok: true });
  }

  return new Response("", { status: 200 });
}