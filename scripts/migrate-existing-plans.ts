/**
 * Migration script to create subscription plans and top-up plans in the database
 * based on existing Stripe Price IDs from environment variables
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migratePlans() {
  console.log("🚀 Starting plan migration...\n");

  // Get Stripe Price IDs from environment
  const starterPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER;
  const proPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO;
  const scalePriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE;

  if (!starterPriceId || !proPriceId || !scalePriceId) {
    console.error("❌ Missing Stripe Price IDs in environment variables!");
    console.error("Required: NEXT_PUBLIC_STRIPE_PRICE_STARTER, NEXT_PUBLIC_STRIPE_PRICE_PRO, NEXT_PUBLIC_STRIPE_PRICE_SCALE");
    process.exit(1);
  }

  try {
    // Create Subscription Plans
    const subscriptionPlans = [
      {
        planFamily: "starter",
        version: 1,
        internalId: "sub_starter_v1",
        publicName: "Starter Plan",
        priceUsd: 10,
        creditsPerCycle: 100,
        creditExpiryDays: 30,
        stripePriceId: starterPriceId,
        stripeProductId: null, // Will be populated from Stripe if needed
        isActiveForNewSignups: true,
        isLegacyOnly: false,
        isHidden: false,
        isDefaultForSignup: true, // Starter is the default
        upgradeAllowedTo: ["sub_pro_v1"],
        downgradeAllowedTo: [],
      },
      {
        planFamily: "pro",
        version: 1,
        internalId: "sub_pro_v1",
        publicName: "Pro Plan",
        priceUsd: 30,
        creditsPerCycle: 500,
        creditExpiryDays: 30,
        stripePriceId: proPriceId,
        stripeProductId: null,
        isActiveForNewSignups: true,
        isLegacyOnly: false,
        isHidden: false,
        isDefaultForSignup: false,
        upgradeAllowedTo: ["sub_business_v1"],
        downgradeAllowedTo: ["sub_starter_v1"],
      },
      {
        planFamily: "business",
        version: 1,
        internalId: "sub_business_v1",
        publicName: "Business Plan",
        priceUsd: 60,
        creditsPerCycle: 1000,
        creditExpiryDays: 30,
        stripePriceId: scalePriceId,
        stripeProductId: null,
        isActiveForNewSignups: true,
        isLegacyOnly: false,
        isHidden: false,
        isDefaultForSignup: false,
        upgradeAllowedTo: [],
        downgradeAllowedTo: ["sub_pro_v1"],
      },
    ];

    console.log("📝 Creating subscription plans...");
    for (const planData of subscriptionPlans) {
      // Check if plan already exists
      const existing = await prisma.subscriptionPlan.findFirst({
        where: {
          OR: [
            { internalId: planData.internalId },
            { stripePriceId: planData.stripePriceId },
          ],
        },
      });

      if (existing) {
        console.log(`  ⏭️  Skipping ${planData.publicName} (already exists)`);
        continue;
      }

      const plan = await prisma.subscriptionPlan.create({
        data: planData,
      });

      console.log(`  ✅ Created: ${plan.publicName} (${plan.internalId})`);
    }

    // Create example Top-Up Plans (you can customize these)
    const topUpPlans = [
      {
        internalId: "topup_1000_v1",
        publicName: "1,000 Credit Pack",
        priceUsd: 10,
        creditsGranted: 1000,
        creditExpiryDays: 365,
        stripePriceId: null, // Add Stripe Price ID if you have top-up products
        stripeProductId: null,
        canPurchaseWithoutSubscription: true,
        isActive: true,
        isHidden: false,
      },
      {
        internalId: "topup_5000_v1",
        publicName: "5,000 Credit Pack",
        priceUsd: 40,
        creditsGranted: 5000,
        creditExpiryDays: 365,
        stripePriceId: null,
        stripeProductId: null,
        canPurchaseWithoutSubscription: true,
        isActive: true,
        isHidden: false,
      },
      {
        internalId: "topup_10000_v1",
        publicName: "10,000 Credit Pack",
        priceUsd: 70,
        creditsGranted: 10000,
        creditExpiryDays: 365,
        stripePriceId: null,
        stripeProductId: null,
        canPurchaseWithoutSubscription: true,
        isActive: true,
        isHidden: false,
      },
    ];

    console.log("\n📝 Creating top-up plans...");
    for (const planData of topUpPlans) {
      const existing = await prisma.topUpPlan.findUnique({
        where: { internalId: planData.internalId },
      });

      if (existing) {
        console.log(`  ⏭️  Skipping ${planData.publicName} (already exists)`);
        continue;
      }

      const plan = await prisma.topUpPlan.create({
        data: planData,
      });

      console.log(`  ✅ Created: ${plan.publicName} (${plan.internalId})`);
    }

    console.log("\n✨ Migration completed successfully!");
    console.log("\n📊 Summary:");
    const subCount = await prisma.subscriptionPlan.count();
    const topUpCount = await prisma.topUpPlan.count();
    console.log(`  - Subscription Plans: ${subCount}`);
    console.log(`  - Top-Up Plans: ${topUpCount}`);
  } catch (error: any) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migratePlans();

