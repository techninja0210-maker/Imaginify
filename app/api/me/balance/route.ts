import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';

/**
 * GET /api/me/balance
 * Get current user's credit balance
 */
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
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

    const orgBalance = user.organizationMembers?.[0]?.organization?.credits?.balance || 0;

    return NextResponse.json({
      success: true,
      balance: user.creditBalance || 0,
      orgBalance,
      inSync: user.creditBalance === orgBalance,
      email: user.email,
      clerkId: user.clerkId
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Failed to fetch balance'
    }, { status: 500 });
  }
}

