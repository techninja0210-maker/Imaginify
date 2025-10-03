"use server";

import { redirect } from 'next/navigation'
import Stripe from "stripe";
import { handleError } from '../utils';
import { prisma } from '../database/prisma';
import { updateCredits, getUserOrganizationId } from './user.actions';

export async function checkoutCredits(transaction: CheckoutTransactionParams) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const amount = Number(transaction.amount) * 100;

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
    metadata: {
      plan: transaction.plan,
      credits: transaction.credits,
      buyerId: transaction.buyerId,
    },
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/profile`,
    cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/`,
  })

  redirect(session.url!)
}

export async function createTransaction(transaction: CreateTransactionParams) {
  try {
    // Get user's organization ID
    const organizationId = await getUserOrganizationId(transaction.buyerId);
    
    // Create transaction
    const newTransaction = await prisma.transaction.create({
      data: {
        userId: transaction.buyerId,
        stripeId: transaction.stripeId,
        amount: transaction.amount,
        plan: transaction.plan,
        credits: transaction.credits,
        status: 'completed'
      }
    });

    // Update credits using the new ledger system
    if (organizationId && transaction.credits) {
      await updateCredits(organizationId, transaction.credits, `Purchase: ${transaction.plan}`);
    }

    return JSON.parse(JSON.stringify(newTransaction));
  } catch (error) {
    handleError(error)
  }
}