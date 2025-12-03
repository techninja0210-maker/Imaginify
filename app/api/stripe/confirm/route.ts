import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/database/prisma';
import { updateCredits } from '@/lib/actions/user.actions';
import { grantCreditsWithExpiry } from '@/lib/actions/credit-grant-with-expiry';
import { findOrCreateTopUpPlan } from '@/lib/services/stripe-plans';
import { createTransaction } from '@/lib/actions/transaction.action';
import { revalidatePath } from 'next/cache';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Session not paid' }, { status: 400 });
    }

    const metadata: any = session.metadata || {};
    const buyerId = metadata.clerkUserId || metadata.buyerId;
    const credits = Number(metadata.credits || 0);
    const amount = typeof session.amount_total === 'number' ? session.amount_total / 100 : 0;

    if (!buyerId) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'No buyerId in metadata' });
    }

    if (!credits || credits <= 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'No credits in metadata' });
    }

    // Verify user exists before attempting to grant credits
    const userExists = await prisma.user.findUnique({
      where: { clerkId: buyerId },
      select: { id: true }
    });

    if (!userExists) {
      console.error(`[STRIPE_CONFIRM] User not found: ${buyerId}`);
      return NextResponse.json({ 
        error: 'User not found', 
        buyerId,
        details: 'The user associated with this purchase does not exist in the database'
      }, { status: 404 });
    }

    // Idempotent grant using unique key per session
    const idemKey = `stripe:session:${session.id}`;

    // Check if already processed (idempotency check)
    const existingLedger = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: idemKey }
    });

    if (existingLedger) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Already processed' });
    }

    // Grant credits using the grant system (consistent with webhook)
    console.log(`[STRIPE_CONFIRM] ✅ Starting credit grant: buyerId=${buyerId}, credits=${credits}, idemKey=${idemKey}`);
    
    try {
      // Try to use grant system for top-ups (get price ID from session)
      const sessionWithItems = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items']
      });
      const priceId = sessionWithItems.line_items?.data?.[0]?.price?.id as string | undefined;

      if (priceId) {
        // Use grant system for top-ups
        try {
          const planResult = await findOrCreateTopUpPlan(priceId);
          const plan = await prisma.topUpPlan.findUnique({
            where: { id: planResult.id }
          });

          if (plan) {
            const user = await prisma.user.findUnique({
              where: { clerkId: buyerId }
            });

            if (!user) {
              throw new Error(`User not found: ${buyerId}`);
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + plan.creditExpiryDays);

            // Create top-up purchase record
            const topUpPurchase = await prisma.topUpPurchase.create({
              data: {
                userId: user.id,
                planId: plan.id,
                stripeSessionId: session.id,
                amount: amount,
                creditsGranted: credits,
                expiresAt,
              }
            });

            // Grant credits with expiry
            await grantCreditsWithExpiry({
              userId: buyerId,
              type: "TOPUP",
              amount: credits,
              expiresAt,
              reason: `Top-up purchase ${session.id}`,
              planId: plan.id,
              topUpPurchaseId: topUpPurchase.id,
              idempotencyKey: idemKey,
              metadata: {
                stripeSessionId: session.id,
                planName: plan.publicName,
              }
            });

            console.log(`[STRIPE_CONFIRM] ✅ Top-up credits granted with expiry: ${credits} credits, expires ${expiresAt.toISOString()}`);
          } else {
            throw new Error(`Failed to find top-up plan for price ${priceId}`);
          }
        } catch (grantError: any) {
          console.warn(`[STRIPE_CONFIRM] Grant system failed, falling back to updateCredits:`, grantError?.message);
          // Fallback to old method if grant system fails
          const creditResult = await updateCredits(buyerId, credits, `Checkout confirmation ${session.id}`, idemKey);
          if (!creditResult) {
            throw new Error('updateCredits returned null/undefined');
          }
        }
      } else {
        // No price ID - use old method as fallback
        console.log(`[STRIPE_CONFIRM] No price ID found, using updateCredits fallback`);
        const creditResult = await updateCredits(buyerId, credits, `Checkout confirmation ${session.id}`, idemKey);
        if (!creditResult) {
          throw new Error('updateCredits returned null/undefined');
        }
      }
    } catch (creditError: any) {
      console.error(`[STRIPE_CONFIRM] ❌ Credit grant failed:`, creditError?.message || creditError);
      return NextResponse.json({ 
        error: 'Failed to update credits', 
        details: creditError?.message,
        stack: process.env.NODE_ENV === 'development' ? creditError.stack : undefined
      }, { status: 500 });
    }

    // Verify credits were actually updated
    const verifyUser = await prisma.user.findUnique({
      where: { clerkId: buyerId },
      select: { creditBalance: true }
    });
    
    // Get effective balance from grants for accurate display
    let newBalance = verifyUser?.creditBalance || 0;
    try {
      const { getActiveCreditGrants } = await import('@/lib/services/credit-grants');
      const grantSummary = await getActiveCreditGrants(userExists.id);
      newBalance = grantSummary.totalAvailable;
    } catch (error) {
      // Fallback to creditBalance
      console.warn('[STRIPE_CONFIRM] Failed to get effective balance, using creditBalance');
    }
    
    console.log(`[STRIPE_CONFIRM] ✅ Verified user balance after grant: ${newBalance} (was expecting ${(verifyUser?.creditBalance || 0)} + ${credits} = ${(verifyUser?.creditBalance || 0) + credits})`);
    console.log(`[STRIPE_CONFIRM] ✅ Credit grant completed successfully`);

    try {
      await createTransaction({
        buyerId,
        stripeId: session.id,
        amount,
        plan: metadata.plan || 'Top-up',
        credits,
      } as any);
      console.log(`[STRIPE_CONFIRM] Transaction recorded successfully`);
    } catch (txError: any) {
      console.error('[STRIPE_CONFIRM] Transaction record creation failed:', txError);
      // Continue even if transaction record fails
    }

    // Persist stripeCustomerId if available
    if (session.customer && typeof session.customer === 'string') {
      try {
        await prisma.user.update({ 
          where: { clerkId: buyerId }, 
          data: { stripeCustomerId: session.customer } 
        });
        console.log(`[STRIPE_CONFIRM] Stripe customer ID updated:`, session.customer);
      } catch (customerError: any) {
        console.error('[STRIPE_CONFIRM] Failed to update stripeCustomerId:', customerError);
        // Continue even if customer ID update fails
      }
    }

    // Revalidate all pages to show updated credits
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/billing');
    revalidatePath('/credits');
    
    console.log(`[STRIPE_CONFIRM] ✅ Returning success response:`, {
      creditsGranted: credits,
      newBalance: newBalance,
      buyerId: buyerId,
      sessionId: session.id
    });
    
    return NextResponse.json({ 
      ok: true, 
      success: true,
      creditsGranted: credits,
      newBalance: newBalance,
      buyerId: buyerId,
      sessionId: session.id,
      message: `Successfully granted ${credits} credits`
    });
  } catch (e: any) {
    console.error('Credit confirmation error:', e);
    return NextResponse.json({ 
      error: e?.message || 'Error processing credit purchase',
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 });
  }
}


