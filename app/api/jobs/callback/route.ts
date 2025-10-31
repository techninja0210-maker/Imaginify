import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/database/prisma';

/**
 * POST /api/jobs/callback
 * External service callback to update job status (e.g., from n8n)
 * 
 * Requires HMAC signature verification
 * Body: { jobId: string, status: string, resultUrl?: string, errorMessage?: string }
 */
function verifyHMAC(body: string, signature: string | null): boolean {
  const secret = process.env.SHARED_HMAC_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(req: Request) {
  try {
    // Verify HMAC signature
    const rawBody = await req.text();
    const signature = req.headers.get('x-hmac-signature');
    
    if (!verifyHMAC(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { jobId, status, resultUrl, errorMessage, metadata } = body;

    if (!jobId || !status) {
      return NextResponse.json({ error: 'jobId and status are required' }, { status: 400 });
    }

    // Valid statuses
    const validStatuses = ['running', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      }, { status: 400 });
    }

    // Get job
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Update job status
    const updateData: any = {
      status,
      metadata: {
        ...((job.metadata as any) || {}),
        ...(metadata || {}),
        lastCallbackAt: new Date().toISOString(),
      }
    };

    if (status === 'running' && !job.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === 'completed') {
      updateData.completedAt = new Date();
      if (resultUrl) updateData.resultUrl = resultUrl;
    }

    if (status === 'failed' || status === 'cancelled') {
      updateData.failedAt = new Date();
      if (errorMessage) updateData.errorMessage = errorMessage;
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        updatedAt: updatedJob.updatedAt
      }
    });
  } catch (error: any) {
    console.error('[POST /api/jobs/callback] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Failed to update job',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

