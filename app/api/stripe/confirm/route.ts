import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/database/prisma';
import { updateCredits } from '@/lib/actions/user.actions';
import { createTransaction } from '@/lib/actions/transaction.action';

export const dynamic = "force-dynamic";

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

    // Idempotent grant using unique key per session
    const idemKey = `stripe:session:${session.id}`;

    // Check if already processed (idempotency check)
    const existingLedger = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: idemKey }
    });

    if (existingLedger) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Already processed' });
    }

    // Grant credits and record transaction
    console.log(`[STRIPE_CONFIRM] Starting credit grant: buyerId=${buyerId}, credits=${credits}, idemKey=${idemKey}`);
    
    let creditResult;
    try {
      creditResult = await updateCredits(buyerId, credits, `Checkout confirmation ${session.id}`, idemKey);
      console.log(`[STRIPE_CONFIRM] updateCredits returned:`, creditResult ? 'success' : 'null/undefined');
    } catch (creditError: any) {
      console.error(`[STRIPE_CONFIRM] updateCredits threw error:`, creditError);
      return NextResponse.json({ 
        error: 'Failed to update credits', 
        details: creditError?.message,
        stack: process.env.NODE_ENV === 'development' ? creditError.stack : undefined
      }, { status: 500 });
    }
    
    if (!creditResult) {
      console.error(`[STRIPE_CONFIRM] updateCredits returned null/undefined`);
      return NextResponse.json({ error: 'Failed to update credits - function returned null' }, { status: 500 });
    }

    // Verify credits were actually updated
    const verifyUser = await prisma.user.findUnique({
      where: { clerkId: buyerId },
      select: { creditBalance: true }
    });
    
    console.log(`[STRIPE_CONFIRM] Verified user balance after grant:`, verifyUser?.creditBalance);

    try {
      await createTransaction({
        buyerId,
        stripeId: session.id,
        amount,
        plan: metadata.plan || 'Top-up',
        credits,
      } as any);
    } catch (txError: any) {
      console.error('Transaction record creation failed:', txError);
      // Continue even if transaction record fails
    }

    // Persist stripeCustomerId if available
    if (session.customer && typeof session.customer === 'string') {
      try {
        await prisma.user.update({ 
          where: { clerkId: buyerId }, 
          data: { stripeCustomerId: session.customer } 
        });
      } catch (customerError: any) {
        console.error('Failed to update stripeCustomerId:', customerError);
        // Continue even if customer ID update fails
      }
    }

    return NextResponse.json({ 
      ok: true, 
      creditsGranted: credits,
      newBalance: (creditResult as any)?.creditBalance 
    });
  } catch (e: any) {
    console.error('Credit confirmation error:', e);
    return NextResponse.json({ 
      error: e?.message || 'Error processing credit purchase',
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 });
  }
}


