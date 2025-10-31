import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';

export const dynamic = "force-dynamic";

/**
 * Sync user credit balance to match organization balance
 * POST /api/admin/sync-credits?email=techninja0210@gmail.com
 */
export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || 'techninja0210@gmail.com';

    // Get user with org info
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
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const orgId = user.organizationMembers?.[0]?.organization?.id;
    const orgCredits = user.organizationMembers?.[0]?.organization?.credits;

    if (!orgId || !orgCredits) {
      return NextResponse.json({ error: 'User organization not found' }, { status: 404 });
    }

    const userBalanceBefore = user.creditBalance;
    const orgBalance = orgCredits.balance;

    // Sync user balance to match org balance
    const result = await prisma.$transaction(async (tx) => {
      // Update user balance to match org balance
      const updatedUser = await tx.user.update({
        where: { clerkId: user.clerkId },
        data: { creditBalance: orgBalance }
      });

      // Create a ledger entry to record the sync
      await tx.creditLedger.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          type: 'allocation',
          amount: orgBalance - userBalanceBefore,
          reason: `Balance sync: Org balance (${orgBalance}) - User balance (${userBalanceBefore})`,
          idempotencyKey: `sync:${Date.now()}:${user.clerkId}`
        }
      });

      return updatedUser;
    });

    return NextResponse.json({
      success: true,
      message: 'Credit balance synced successfully',
      before: {
        userBalance: userBalanceBefore,
        orgBalance: orgBalance,
      },
      after: {
        userBalance: result.creditBalance,
        orgBalance: orgBalance,
      },
      difference: orgBalance - userBalanceBefore,
      synced: true
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Sync failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

