import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Determine organization to seed for
  let organizationId = process.env.SEED_ORG_ID
  if (!organizationId) {
    // Create or find a demo organization
    const demo = await prisma.organization.upsert({
      where: { clerkId: 'seed_org' },
      update: {},
      create: {
        clerkId: 'seed_org',
        name: 'Demo Organization',
      },
    })
    organizationId = demo.id

    // Ensure a credit balance row exists
    await prisma.creditBalance.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId, balance: 1000 },
    })

    console.log(`Using demo organization ${organizationId}`)
  }

  const entries = [
    {
      actionKey: 'text_to_video',
      unitType: 'seconds',
      unitStep: 1,
      retailCostPerUnit: 2, // 2 credits per second
      internalCostFormula: 'units * 0.8',
    },
    {
      actionKey: 'image_to_video',
      unitType: 'seconds',
      unitStep: 1,
      retailCostPerUnit: 2,
      internalCostFormula: 'units * 0.8',
    },
    {
      actionKey: 'product_video',
      unitType: 'seconds',
      unitStep: 1,
      retailCostPerUnit: 3,
      internalCostFormula: 'units * 1.2',
    },
  ]

  for (const e of entries) {
    await prisma.priceBookEntry.upsert({
      where: { organizationId_actionKey: { organizationId, actionKey: e.actionKey } },
      update: {
        unitType: e.unitType,
        unitStep: e.unitStep,
        retailCostPerUnit: e.retailCostPerUnit,
        internalCostFormula: e.internalCostFormula,
        isActive: true,
      },
      create: {
        organizationId,
        actionKey: e.actionKey,
        unitType: e.unitType,
        unitStep: e.unitStep,
        retailCostPerUnit: e.retailCostPerUnit,
        internalCostFormula: e.internalCostFormula,
        isActive: true,
      },
    })
  }

  console.log('Seed completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


