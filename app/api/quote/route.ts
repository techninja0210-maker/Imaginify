import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createOrGetProvisionalQuote } from '@/lib/services/pricing';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({}));
  const actionKey = String(body?.actionKey || '');
  const units = Number(body?.units || 0);
  const parameters = body?.parameters ?? {};

  if (!actionKey || !Number.isFinite(units) || units <= 0) {
    return NextResponse.json({ error: 'Invalid actionKey or units' }, { status: 400 });
  }

  try {
    const quote = await createOrGetProvisionalQuote({
      clerkUserId: userId,
      actionKey,
      parameters,
      units,
    });

    return NextResponse.json({
      success: true,
      id: quote.id,
      actionKey,
      totalCredits: quote.totalCredits,
      expiresAt: quote.expiresAt,
      status: quote.status,
      breakdown: quote.breakdown,
    });
  } catch (e: any) {
    console.error('[POST /api/quote] Error:', e);
    return NextResponse.json({ 
      error: e?.message || 'Error creating quote',
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 });
  }
}


