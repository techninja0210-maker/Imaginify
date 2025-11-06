import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';
import { updateCredits } from '@/lib/actions/user.actions';
import Stripe from 'stripe';

export const dynamic = "force-dynamic";

/**
 * POST /api/credits/manual-grant
 * User-facing endpoint to manually grant credits for a purchase
 * 
 * Body: { sessionId: string } - The Stripe checkout session ID
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ 
        error: 'sessionId is required',
        hint: 'Get the session ID from your Stripe transaction (starts with cs_test_ or cs_live_)'
      }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Retrieve the Stripe session
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (stripeError: any) {
      return NextResponse.json({
        error: 'Failed to retrieve Stripe session',
        details: stripeError?.message,
        hint: 'Make sure the session ID is correct (starts with cs_test_ or cs_live_)'
      }, { status: 400 });
    }

    // Verify payment status
    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        error: 'Session not paid',
        paymentStatus: session.payment_status,
        hint: 'Only paid sessions can grant credits'
      }, { status: 400 });
    }

    // Get metadata
    const metadata: any = session.metadata || {};
    const buyerId = metadata.clerkUserId || metadata.buyerId;
    const credits = Number(metadata.credits || 0);

    // Verify this session belongs to the current user
    if (buyerId !== userId) {
      return NextResponse.json({
        error: 'Unauthorized',
        hint: 'This purchase does not belong to your account'
      }, { status: 403 });
    }

    if (!buyerId) {
      return NextResponse.json({
        error: 'No buyerId in session metadata',
        sessionId,
        metadata,
        hint: 'The Stripe session is missing user information. Contact support.'
      }, { status: 400 });
    }

    if (!credits || credits <= 0) {
      return NextResponse.json({
        error: 'No credits in session metadata',
        sessionId,
        metadata,
        hint: 'The Stripe session is missing credit information. Contact support.'
      }, { status: 400 });
    }

    // Check if already processed (idempotency)
    const idemKey = `stripe:session:${session.id}`;
    const existingLedger = await prisma.creditLedger.findUnique({
      where: { idempotencyKey: idemKey },
      include: {
        user: {
          select: { email: true, creditBalance: true }
        }
      }
    });

    if (existingLedger) {
      return NextResponse.json({
        success: true,
        message: 'Credits already granted for this purchase',
        sessionId,
        creditsGranted: existingLedger.amount,
        currentBalance: existingLedger.user?.creditBalance || null,
        grantedAt: existingLedger.createdAt,
        hint: 'Your credits should already be in your account. Please refresh the page.'
      }, { status: 200 });
    }

    // Grant credits
    console.log(`[MANUAL_GRANT] Starting credit grant: userId=${userId}, sessionId=${sessionId}, credits=${credits}`);
    
    let creditResult;
    try {
      creditResult = await updateCredits(
        userId,
        credits,
        `Manual grant for purchase ${sessionId}`,
        idemKey
      );
      
      if (!creditResult) {
        throw new Error('updateCredits returned null/undefined');
      }
    } catch (creditError: any) {
      console.error(`[MANUAL_GRANT] Credit grant failed:`, creditError);
      return NextResponse.json({
        error: 'Failed to grant credits',
        details: creditError?.message,
        hint: 'There was an error processing your credits. Please contact support with this error message.'
      }, { status: 500 });
    }

    // Verify credits were added
    const verifyUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { creditBalance: true, email: true }
    });

    // Record transaction if not exists
    try {
      const existingTransaction = await prisma.transaction.findUnique({
        where: { stripeId: session.id }
      });

      if (!existingTransaction) {
        await prisma.transaction.create({
          data: {
            userId: verifyUser ? (await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } }))?.id || '' : '',
            stripeId: session.id,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            plan: metadata.plan || 'Top-up',
            credits: credits,
            status: 'completed'
          }
        });
      }
    } catch (txError: any) {
      console.error('[MANUAL_GRANT] Transaction record failed:', txError);
      // Continue even if transaction record fails
    }

    return NextResponse.json({
      success: true,
      message: 'Credits granted successfully!',
      sessionId,
      creditsGranted: credits,
      newBalance: verifyUser?.creditBalance || null,
      hint: 'Please refresh the page to see your updated balance.'
    });

  } catch (error: any) {
    console.error('[MANUAL_GRANT] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

