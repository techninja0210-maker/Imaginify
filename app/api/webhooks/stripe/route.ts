/* eslint-disable camelcase */
import { createTransaction } from "@/lib/actions/transaction.action";
import { updateCredits, getUserOrganizationId } from "@/lib/actions/user.actions";
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
        console.log(`Subscription ${eventType} for user ${user.clerkId}, customer ${customerId}`);
        
        // Update user with subscription info (you can add subscription fields to User model if needed)
        await prisma.user.update({
          where: { clerkId: user.clerkId },
          data: { 
            // Add any subscription-related fields here if you extend the User model
            // For now, we just log the event
          }
        });
      }
    } catch (error) {
      console.error(`Error handling subscription ${eventType}:`, error);
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
      await updateCredits(clerkUserId, planCredits, `Subscription credit grant ${subscriptionId}`, `stripe:invoice:${invoice.id}`);
    }

    return NextResponse.json({ ok: true });
  }

  return new Response("", { status: 200 });
}