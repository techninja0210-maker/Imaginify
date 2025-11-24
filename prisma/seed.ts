import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const entries = [
    {
      pipelineKey: 'text_to_video',
      creditCost: 5,
    },
    {
      pipelineKey: 'image_to_video',
      creditCost: 5,
    },
    {
      pipelineKey: 'product_video',
      creditCost: 10,
    },
    {
      pipelineKey: 'restore',
      creditCost: 1,
    },
    {
      pipelineKey: 'fill',
      creditCost: 2,
    },
    {
      pipelineKey: 'remove',
      creditCost: 2,
    },
    {
      pipelineKey: 'recolor',
      creditCost: 2,
    },
    {
      pipelineKey: 'removeBackground',
      creditCost: 1,
    },
  ]

  for (const e of entries) {
    await prisma.priceBookEntry.upsert({
      where: { pipelineKey: e.pipelineKey },
      update: {
        creditCost: e.creditCost,
        active: true,
      },
      create: {
        pipelineKey: e.pipelineKey,
        creditCost: e.creditCost,
        active: true,
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
