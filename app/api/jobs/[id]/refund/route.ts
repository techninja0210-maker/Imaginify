import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';
import { updateCredits } from '@/lib/actions/user.actions';
import { requireAdmin } from '@/lib/auth/admin-auth';

/**
 * POST /api/jobs/:id/refund
 * Refund credits for a failed/cancelled job (admin only)
 * 
 * Body: { amount?: number, reason?: string }
 * - If amount not provided, refunds full quotedCredits
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Admin only
    const currentUser = await requireAdmin();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const jobId = params.id;
    const body = await req.json().catch(() => ({}));
    const { amount, reason } = body;

    // Get job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        user: {
          select: { clerkId: true }
        }
      }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Determine refund amount
    const refundAmount = amount || job.quotedCredits || 0;
    if (refundAmount <= 0) {
      return NextResponse.json({ error: 'Invalid refund amount' }, { status: 400 });
    }

    // Refund credits
    const refundReason = reason || `Job refund: ${jobId} (${job.status})`;
    const idemKey = `refund:${jobId}:${Date.now()}`;

    await updateCredits(
      job.user.clerkId,
      refundAmount,
      refundReason,
      idemKey
    );

    // Update job status
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'refunded',
        metadata: {
          ...((job.metadata as any) || {}),
          refundedAt: new Date().toISOString(),
          refundAmount,
          refundReason,
        } as any
      }
    });

    return NextResponse.json({
      success: true,
      refunded: refundAmount,
      jobId,
      reason: refundReason
    });
  } catch (error: any) {
    console.error('[POST /api/jobs/:id/refund] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Failed to process refund',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

