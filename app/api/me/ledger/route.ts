import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';

export const dynamic = "force-dynamic";

/**
 * GET /api/me/ledger
 * Get current user's credit ledger (transaction history)
 * 
 * Query params:
 * - limit: number (default: 50)
 * - page: number (default: 1)
 */
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const page = Number(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [entries, total] = await Promise.all([
      prisma.creditLedger.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          type: true,
          amount: true,
          reason: true,
          createdAt: true,
          idempotencyKey: true,
        }
      }),
      prisma.creditLedger.count({ where: { userId: user.id } })
    ]);

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Failed to fetch ledger'
    }, { status: 500 });
  }
}

