import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { updateCredits } from '@/lib/actions/user.actions';
import { requireAdmin } from '@/lib/auth/admin-auth';
import Stripe from 'stripe';

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/grant-all-missing-credits
 * Admin endpoint to grant credits for all Stripe checkout sessions that don't have ledger entries
 * 
 * This will:
 * 1. Get all Stripe checkout sessions (last 100)
 * 2. Check which ones are paid but don't have credit ledger entries
 * 3. Grant credits for those sessions
 */
export async function POST(req: NextRequest) {
  try {
    // Require admin access
    const adminUser = await requireAdmin();
    
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({
        error: 'Stripe not configured'
      }, { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    // Get all checkout sessions from Stripe (last 100)
    const sessions = await stripe.checkout.sessions.list({
      limit: 100
    });

    const results = [];
    let granted = 0;
    let skipped = 0;
    let errors = 0;

    for (const session of sessions.data) {
      try {
        // Only process paid sessions
        if (session.payment_status !== 'paid') {
          skipped++;
          results.push({
            sessionId: session.id,
            status: 'skipped',
            reason: `Payment status: ${session.payment_status}`
          });
          continue;
        }

        // Get metadata from session
        const metadata: any = session.metadata || {};
        const buyerId = metadata.clerkUserId || metadata.buyerId;
        const credits = Number(metadata.credits || 0);

        // Skip if no buyer or credits
        if (!buyerId) {
          skipped++;
          results.push({
            sessionId: session.id,
            status: 'skipped',
            reason: 'No buyerId in metadata'
          });
          continue;
        }

        if (!credits || credits <= 0) {
          skipped++;
          results.push({
            sessionId: session.id,
            status: 'skipped',
            reason: 'No credits in metadata or credits <= 0'
          });
          continue;
        }

        // Verify user exists before attempting to grant credits
        const userExists = await prisma.user.findUnique({
          where: { clerkId: buyerId },
          select: { id: true, email: true }
        });

        if (!userExists) {
          skipped++;
          results.push({
            sessionId: session.id,
            status: 'skipped',
            reason: `User not found: ${buyerId}`,
            buyerId
          });
          continue;
        }

        // Check if already processed
        const idemKey = `stripe:session:${session.id}`;
        
        const existingLedger = await prisma.creditLedger.findUnique({
          where: { idempotencyKey: idemKey }
        });

        if (existingLedger) {
          skipped++;
          results.push({
            sessionId: session.id,
            status: 'already_granted',
            credits,
            buyerId,
            ledgerId: existingLedger.id
          });
          continue;
        }

        // Grant credits
        await updateCredits(
          buyerId,
          credits,
          `Retroactive grant for Stripe checkout session ${session.id}`,
          idemKey
        );

        // Verify credits were granted
        const verifyUser = await prisma.user.findUnique({
          where: { clerkId: buyerId },
          select: { email: true, creditBalance: true }
        });

        granted++;
        results.push({
          sessionId: session.id,
          status: 'granted',
          credits,
          buyerId,
          email: verifyUser?.email,
          newBalance: verifyUser?.creditBalance
        });

        console.log(`[GRANT_ALL_MISSING] Granted ${credits} credits for session ${session.id} to ${buyerId}`);

      } catch (error: any) {
        errors++;
        console.error(`[GRANT_ALL_MISSING] Error processing session ${session.id}:`, error);
        results.push({
          sessionId: session.id,
          status: 'error',
          error: error?.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: sessions.data.length,
        granted,
        skipped,
        errors
      },
      results
    });

  } catch (error: any) {
    console.error('[GRANT_ALL_MISSING_CREDITS] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

