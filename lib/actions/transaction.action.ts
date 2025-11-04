"use server";

import { redirect } from 'next/navigation'
import Stripe from "stripe";
import { handleError } from '../utils';
import { prisma } from '../database/prisma';
import { updateCredits, getUserOrganizationId } from './user.actions';

export async function checkoutCredits(
  transaction: CheckoutTransactionParams,
  rewardfulReferral?: string
) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const amount = Number(transaction.amount) * 100;

  const metadata: Record<string, string> = {
    plan: transaction.plan,
    credits: String(transaction.credits),
    buyerId: transaction.buyerId,
    clerkUserId: transaction.buyerId,
  };

  // Add Rewardful referral if provided
  if (rewardfulReferral) {
    metadata.rewardful_referral = rewardfulReferral;
  }

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          product_data: {
            name: transaction.plan,
          }
        },
        quantity: 1
      }
    ],
    metadata,
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
  })

  redirect(session.url!)
}

export async function createTransaction(transaction: CreateTransactionParams) {
  try {
    // Resolve internal user ID from Clerk ID
    const user = await prisma.user.findUnique({
      where: { clerkId: transaction.buyerId },
      select: { id: true }
    });

    if (!user) {
      throw new Error(`User not found for clerkId: ${transaction.buyerId}`);
    }

    // Create transaction with internal user ID
    const newTransaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        stripeId: transaction.stripeId,
        amount: transaction.amount,
        plan: transaction.plan,
        credits: transaction.credits,
        status: 'completed'
      }
    });

    return JSON.parse(JSON.stringify(newTransaction));
  } catch (error) {
    handleError(error)
  }
}