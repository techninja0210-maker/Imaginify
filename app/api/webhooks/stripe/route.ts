/* eslint-disable camelcase */
import { createTransaction } from "@/lib/actions/transaction.action";
import { updateCredits, getUserOrganizationId } from "@/lib/actions/user.actions";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

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
      buyerId: metadata?.buyerId || "",
      createdAt: new Date(),
    };

    // Persist Stripe customer ID on the user for future billing portal access
    try {
      if (metadata?.clerkUserId && customerId) {
        await prisma.user.update({
          where: { clerkId: metadata.clerkUserId },
          data: { stripeCustomerId: customerId }
        });
      }
    } catch (e) {
      // no-op: we still record the transaction
    }

    const newTransaction = await createTransaction(transaction);

    // Grant purchased credits to the user's organization using idempotency
    if (transaction.buyerId && typeof transaction.buyerId === 'string' && transaction.credits) {
      const organizationId = await getUserOrganizationId(transaction.buyerId);
      if (organizationId) {
        await updateCredits(organizationId, transaction.credits, `Top-up purchase ${transaction.stripeId}` , `stripe:${transaction.stripeId}`);
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

  // Subscription renewal/start via invoice.paid
  if (eventType === "invoice.paid") {
    const invoice = event.data.object as any;
    const subscriptionId = invoice.subscription as string;
    let clerkUserId = invoice.metadata?.clerkUserId as string | undefined;
    let planCredits = Number(invoice.metadata?.planCredits || 0);

    // Fallbacks if metadata is missing
    if (!clerkUserId && invoice.customer) {
      const customerId = invoice.customer as string;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
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
      const organizationId = await getUserOrganizationId(clerkUserId);
      if (organizationId) {
        await updateCredits(organizationId, planCredits, `Subscription credit grant ${subscriptionId}`, `stripe:invoice:${invoice.id}`);
      }
    }

    return NextResponse.json({ ok: true });
  }

  return new Response("", { status: 200 });
}