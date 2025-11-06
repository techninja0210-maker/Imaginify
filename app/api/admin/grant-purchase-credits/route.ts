import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prisma } from '@/lib/database/prisma';
import { updateCredits } from '@/lib/actions/user.actions';
import { requireAdmin } from '@/lib/auth/admin-auth';
import Stripe from 'stripe';

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/grant-purchase-credits
 * Admin endpoint to manually grant credits for a Stripe purchase
 * 
 * Body: { sessionId: string } or { email: string, credits: number, reason?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Require admin access
    const adminUser = await requireAdmin();
    
    const body = await req.json();
    const { sessionId, email, credits, reason } = body;

    // If sessionId provided, try to grant credits from Stripe session
    if (sessionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status !== 'paid') {
          return NextResponse.json({
            error: 'Session not paid',
            sessionId,
            paymentStatus: session.payment_status
          }, { status: 400 });
        }

        const metadata: any = session.metadata || {};
        const buyerId = metadata.clerkUserId || metadata.buyerId;
        const sessionCredits = Number(metadata.credits || 0);

        if (!buyerId) {
          return NextResponse.json({
            error: 'No buyerId in session metadata',
            sessionId,
            metadata
          }, { status: 400 });
        }

        if (!sessionCredits || sessionCredits <= 0) {
          return NextResponse.json({
            error: 'No credits in session metadata',
            sessionId,
            metadata
          }, { status: 400 });
        }

        // Check if already processed
        const idemKey = `stripe:session:${session.id}`;
        const existingLedger = await prisma.creditLedger.findUnique({
          where: { idempotencyKey: idemKey }
        });

        if (existingLedger) {
          return NextResponse.json({
            success: false,
            message: 'Credits already granted for this session',
            sessionId,
            ledgerId: existingLedger.id
          }, { status: 200 });
        }

        // Grant credits
        const result = await updateCredits(
          buyerId,
          sessionCredits,
          `Manual grant from admin - session ${sessionId}`,
          idemKey
        );

        // Verify
        const verifyUser = await prisma.user.findUnique({
          where: { clerkId: buyerId },
          select: { email: true, creditBalance: true }
        });

        return NextResponse.json({
          success: true,
          message: 'Credits granted successfully',
          sessionId,
          buyerId,
          email: verifyUser?.email,
          creditsGranted: sessionCredits,
          newBalance: verifyUser?.creditBalance
        });

      } catch (stripeError: any) {
        return NextResponse.json({
          error: 'Failed to retrieve Stripe session',
          details: stripeError?.message
        }, { status: 500 });
      }
    }

    // If email and credits provided, grant directly
    if (email && credits) {
      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        return NextResponse.json({
          error: `User not found with email: ${email}`
        }, { status: 404 });
      }

      const result = await updateCredits(
        user.clerkId,
        credits,
        reason || `Manual grant from admin`,
        `admin:manual:${Date.now()}`
      );

      const verifyUser = await prisma.user.findUnique({
        where: { clerkId: user.clerkId },
        select: { creditBalance: true }
      });

      return NextResponse.json({
        success: true,
        message: 'Credits granted successfully',
        email,
        creditsGranted: credits,
        newBalance: verifyUser?.creditBalance
      });
    }

    return NextResponse.json({
      error: 'Either sessionId or (email + credits) must be provided'
    }, { status: 400 });

  } catch (error: any) {
    console.error('[ADMIN GRANT PURCHASE CREDITS] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

