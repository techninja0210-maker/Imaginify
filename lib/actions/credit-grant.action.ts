"use server";

import { updateCredits } from "./user.actions";
import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";
import { revalidatePath } from "next/cache";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

/**
 * Server action to grant credits for a Stripe checkout session
 * This can be called directly from client components
 */
export async function grantCreditsForSession(sessionId: string) {
  try {
    console.log(`[GRANT_CREDITS_ACTION] Starting grant for session: ${sessionId}`);
    
    if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
      return { success: false, error: "Missing sessionId or Stripe key" };
    }

    // Check if already processed
    const idemKey = `stripe:session:${sessionId}`;
    const existingLedger = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: idemKey }
    });

    if (existingLedger) {
      console.log(`[GRANT_CREDITS_ACTION] Already processed: ${sessionId}`);
      return { success: true, skipped: true, message: "Already processed" };
    }

    // Get Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: `Session not paid: ${session.payment_status}` };
    }

    const metadata: any = session.metadata || {};
    const buyerId = metadata.clerkUserId || metadata.buyerId;
    const credits = Number(metadata.credits || 0);

    if (!buyerId) {
      return { success: false, error: "No buyerId in metadata" };
    }

    if (!credits || credits <= 0) {
      return { success: false, error: "No credits in metadata" };
    }

    // Verify user exists
    const userExists = await prisma.user.findUnique({
      where: { clerkId: buyerId },
      select: { id: true, creditBalance: true }
    });

    if (!userExists) {
      return { success: false, error: `User not found: ${buyerId}` };
    }

    // Grant credits
    const result = await updateCredits(
      buyerId,
      credits,
      `Checkout confirmation ${sessionId}`,
      idemKey
    );

    if (!result) {
      return { success: false, error: "updateCredits returned null" };
    }

    // Revalidate pages
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/billing');
    revalidatePath('/credits');

    const newBalance = (result as any)?.creditBalance || userExists.creditBalance + credits;

    console.log(`[GRANT_CREDITS_ACTION] ✅ Successfully granted ${credits} credits, new balance: ${newBalance}`);

    return {
      success: true,
      creditsGranted: credits,
      newBalance: newBalance,
      message: `Successfully granted ${credits} credits`
    };
  } catch (error: any) {
    console.error(`[GRANT_CREDITS_ACTION] Error:`, error);
    return {
      success: false,
      error: error?.message || "Failed to grant credits"
    };
  }
}

