import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';

export const dynamic = "force-dynamic";

/**
 * Admin endpoint to check user credit balance by email
 * GET /api/admin/check-balance?email=techninja0210@gmail.com
 */
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || 'techninja0210@gmail.com';

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                credits: true
              }
            }
          }
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        ledger: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) {
      return NextResponse.json({ 
        error: 'User not found',
        email 
      }, { status: 404 });
    }

    const orgId = user.organizationMembers?.[0]?.organization?.id;
    const orgCredits = user.organizationMembers?.[0]?.organization?.credits;

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        clerkId: user.clerkId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        creditBalance: user.creditBalance,
        stripeCustomerId: user.stripeCustomerId || 'Not linked',
      },
      organization: {
        id: orgId || 'N/A',
        creditBalance: orgCredits?.balance || null,
      },
      syncStatus: {
        userBalance: user.creditBalance,
        orgBalance: orgCredits?.balance || 0,
        inSync: user.creditBalance === (orgCredits?.balance || 0),
      },
      recentTransactions: user.transactions.map(tx => ({
        plan: tx.plan,
        credits: tx.credits,
        amount: tx.amount,
        stripeId: tx.stripeId,
        createdAt: tx.createdAt,
      })),
      recentLedger: user.ledger.map(entry => ({
        type: entry.type,
        amount: entry.amount,
        reason: entry.reason,
        idempotencyKey: entry.idempotencyKey,
        createdAt: entry.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Database error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      databaseError: error.code || 'Unknown',
    }, { status: 500 });
  }
}

