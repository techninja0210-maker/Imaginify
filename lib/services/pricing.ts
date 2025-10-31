import crypto from 'crypto';
import { prisma } from '@/lib/database/prisma';

type ComputeInternalOptions = { units: number; formula: string };

function hashJson(value: unknown): string {
  const s = JSON.stringify(value ?? {});
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function computeInternalUsd({ units, formula }: ComputeInternalOptions): number | null {
  // Very small safe parser for patterns like "units * 0.8" or "units*1.2"
  const m = formula.replace(/\s+/g, '').match(/^units\*(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const factor = parseFloat(m[1]);
  if (!Number.isFinite(factor)) return null;
  return units * factor;
}

export async function getEffectivePrice(params: {
  clerkUserId: string;
  actionKey: string;
  units: number;
}) {
  const { clerkUserId, actionKey, units } = params;

  // Resolve organization by the first membership (single-member org assumption for now)
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { organizationMembers: { include: { organization: true } } },
  });
  if (!user || !user.organizationMembers.length) throw new Error('Organization not found for user');
  const organizationId = user.organizationMembers[0].organization.id;

  let entry = await prisma.priceBookEntry.findUnique({
    where: { organizationId_actionKey: { organizationId, actionKey } },
  });
  
  // Auto-create default pricing if missing
  if (!entry) {
    const defaultPricing: Record<string, { retailCostPerUnit: number; internalCostFormula: string; unitType: string }> = {
      'text_to_video': { retailCostPerUnit: 2, internalCostFormula: 'units * 0.8', unitType: 'seconds' },
      'image_to_video': { retailCostPerUnit: 2, internalCostFormula: 'units * 0.8', unitType: 'seconds' },
      'product_video': { retailCostPerUnit: 3, internalCostFormula: 'units * 1.2', unitType: 'seconds' },
    };
    
    const defaults = defaultPricing[actionKey] || { retailCostPerUnit: 1, internalCostFormula: 'units * 0.5', unitType: 'units' };
    
    entry = await prisma.priceBookEntry.create({
      data: {
        organizationId,
        actionKey,
        unitType: defaults.unitType,
        unitStep: 1,
        retailCostPerUnit: defaults.retailCostPerUnit,
        internalCostFormula: defaults.internalCostFormula,
        isActive: true,
      },
    });
  }
  
  if (!entry.isActive) throw new Error('Pricing not active for action');

  const step = Math.max(1, entry.unitStep);
  const normalizedUnits = Math.ceil(units / step) * step;
  const retailCredits = normalizedUnits * entry.retailCostPerUnit;
  const internalUsd = computeInternalUsd({ units: normalizedUnits, formula: entry.internalCostFormula }) ?? null;

  return {
    organizationId,
    unitType: entry.unitType,
    unitStep: step,
    units: normalizedUnits,
    retailCredits,
    internalUsd,
  };
}

export async function createOrGetProvisionalQuote(params: {
  clerkUserId: string;
  actionKey: string;
  parameters: unknown;
  units: number;
  ttlSeconds?: number;
}) {
  const { clerkUserId, actionKey, parameters, units, ttlSeconds = 600 } = params;

  const price = await getEffectivePrice({ clerkUserId, actionKey, units });

  // Resolve user + organization
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: { organizationMembers: { include: { organization: true } } },
  });
  if (!user || !user.organizationMembers.length) throw new Error('User not found');

  const organizationId = user.organizationMembers[0].organization.id;
  const parametersHash = hashJson(parameters);

  // Basic idempotency: if an active, unexpired quote exists with same signature, return it
  const existing = await prisma.jobQuote.findFirst({
    where: {
      organizationId,
      userId: user.id,
      workflowType: actionKey,
      status: 'active',
      expiresAt: { gt: new Date() },
      // parameters hash stored inside parameters for now
      parameters: { equals: { ...((parameters as any) || {}), __hash: parametersHash } as any },
    },
  });
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const quote = await prisma.jobQuote.create({
    data: {
      organizationId,
      userId: user.id,
      workflowType: actionKey,
      parameters: { ...((parameters as any) || {}), __hash: parametersHash },
      totalCredits: price.retailCredits,
      breakdown: {
        unitType: price.unitType,
        unitStep: price.unitStep,
        units: price.units,
        retailCredits: price.retailCredits,
        internalUsd: price.internalUsd,
      } as any,
      expiresAt,
      status: 'active',
    },
  });

  return quote;
}


