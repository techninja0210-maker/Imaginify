import { prisma } from '@/lib/database/prisma';

/**
 * Get credit cost for a pipeline type from Price Book
 * @param pipelineKey - The pipeline key (e.g., 'text_to_video', 'image_to_video')
 * @returns Credit cost as a number, or throws error if not found or inactive
 */
export async function getCreditCost(pipelineKey: string): Promise<number> {
  const entry = await prisma.priceBookEntry.findUnique({
    where: { pipelineKey },
  });

  if (!entry) {
    throw new Error(`Price book entry not found for pipeline: ${pipelineKey}`);
  }

  if (!entry.active) {
    throw new Error(`Pricing not active for pipeline: ${pipelineKey}`);
  }

  return entry.creditCost;
}


