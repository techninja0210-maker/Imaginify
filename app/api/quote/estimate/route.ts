import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectivePrice } from '@/lib/services/pricing';

export const dynamic = "force-dynamic";

/**
 * GET /api/quote/estimate
 * Estimate credits and cost for a workflow without creating a quote
 * Useful for n8n workflows to estimate usage before creating actual quote
 * 
 * Query params:
 * - actionKey: string (required) - The workflow action key
 * - units: number (required) - Number of units to estimate
 */
export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const actionKey = searchParams.get('actionKey');
    const unitsParam = searchParams.get('units');

    if (!actionKey) {
      return NextResponse.json({ error: 'actionKey is required' }, { status: 400 });
    }

    if (!unitsParam) {
      return NextResponse.json({ error: 'units is required' }, { status: 400 });
    }

    const units = Number(unitsParam);
    if (!Number.isFinite(units) || units <= 0) {
      return NextResponse.json({ error: 'units must be a positive number' }, { status: 400 });
    }

    // Get price estimate without creating a quote
    const price = await getEffectivePrice({
      clerkUserId: userId,
      actionKey,
      units,
    });

    return NextResponse.json({
      success: true,
      actionKey,
      units: price.units,
      unitType: price.unitType,
      unitStep: price.unitStep,
      estimatedCredits: price.retailCredits,
      estimatedInternalUsd: price.internalUsd,
      breakdown: {
        normalizedUnits: price.units,
        costPerUnit: price.retailCredits / price.units,
        totalCredits: price.retailCredits,
        internalUsd: price.internalUsd,
      },
    });
  } catch (e: any) {
    console.error('[GET /api/quote/estimate] Error:', e);
    return NextResponse.json({ 
      error: e?.message || 'Error estimating quote',
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    }, { status: 500 });
  }
}

