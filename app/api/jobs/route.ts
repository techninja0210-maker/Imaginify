import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';

export const dynamic = "force-dynamic";

/**
 * POST /api/jobs
 * Note: Quote system removed. Jobs are created directly via addJob() server action.
 * This endpoint is kept for backward compatibility but returns an error.
 */
export async function POST(req: Request) {
  return NextResponse.json({
    error: 'Quote system removed. Use addJob() server action instead.',
  }, { status: 410 }); // 410 Gone
}

/**
 * GET /api/jobs
 * List jobs for the authenticated user
 */
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit')) || 20;
    const page = Number(searchParams.get('page')) || 1;
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          title: true,
          status: true,
          quotedCredits: true,
          totalRetailCostCredits: true,
          createdAt: true,
          confirmedAt: true,
          completedAt: true,
        }
      }),
      prisma.job.count({ where: { userId: user.id } })
    ]);

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || 'Failed to fetch jobs'
    }, { status: 500 });
  }
}

