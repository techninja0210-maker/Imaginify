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

  // Determine the base URL - detect development vs production
  // In development, always use localhost to avoid redirecting to production
  const getBaseUrl = () => {
    // Check if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         !process.env.NEXT_PUBLIC_SERVER_URL ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('localhost') ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('127.0.0.1') ||
                         process.env.NEXT_PUBLIC_SERVER_URL.includes('192.168');
    
    if (isDevelopment) {
      // In development, always use localhost
      return 'http://localhost:3000';
    }
    
    // In production, use the configured URL
    return process.env.NEXT_PUBLIC_SERVER_URL || 'https://shoppablevideos.com';
  };

  const baseUrl = getBaseUrl();
  console.log(`[CHECKOUT] Using base URL for Stripe redirect: ${baseUrl} (NODE_ENV: ${process.env.NODE_ENV})`);

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
    success_url: `${baseUrl}/?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/`,
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