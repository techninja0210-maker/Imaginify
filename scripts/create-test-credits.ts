/**
 * Helper script to create test credit grants for testing
 * Run with: npm run test:create-credits
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createTestCredits() {
  console.log("🧪 Creating Test Credit Grants\n");

  try {
    // Find any user (prefer test users, but use any if none found)
    let testUser = await prisma.user.findFirst({
      where: { email: { contains: "test" } },
    });

    if (!testUser) {
      // Use first user found
      testUser = await prisma.user.findFirst();
    }

    if (!testUser) {
      console.log("❌ No users found in database. Please create a user first.");
      console.log("   Sign up at: http://localhost:3000/sign-up");
      return;
    }

    console.log(`📋 Using user: ${testUser.email} (${testUser.id})\n`);

    // Get or create a subscription plan
    let plan = await prisma.subscriptionPlan.findFirst({
      where: { isActiveForNewSignups: true },
    });

    if (!plan) {
      console.log("⚠️  No subscription plan found. Creating test plan...");
      plan = await prisma.subscriptionPlan.create({
        data: {
          planFamily: "test",
          version: 1,
          internalId: "sub_test_v1",
          publicName: "Test Plan",
          priceUsd: 10,
          creditsPerCycle: 100,
          creditExpiryDays: 30,
          isActiveForNewSignups: true,
        },
      });
    }

    // Create subscription credit grant (expires in 30 days)
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);

    const subGrant = await prisma.creditGrant.create({
      data: {
        userId: testUser.id,
        type: "SUBSCRIPTION",
        amount: 100,
        usedAmount: 0,
        expiresAt: subscriptionExpiry,
        planId: plan.id,
      },
    });

    console.log("✅ Created subscription credit grant:");
    console.log(`   Amount: 100 credits`);
    console.log(`   Expires: ${subscriptionExpiry.toISOString()}`);
    console.log(`   ID: ${subGrant.id}\n`);

    // Create top-up credit grant (expires in 365 days)
    const topUpExpiry = new Date();
    topUpExpiry.setDate(topUpExpiry.getDate() + 365);

    const topUpGrant = await prisma.creditGrant.create({
      data: {
        userId: testUser.id,
        type: "TOPUP",
        amount: 50,
        usedAmount: 0,
        expiresAt: topUpExpiry,
      },
    });

    console.log("✅ Created top-up credit grant:");
    console.log(`   Amount: 50 credits`);
    console.log(`   Expires: ${topUpExpiry.toISOString()}`);
    console.log(`   ID: ${topUpGrant.id}\n`);

    // Update user balance
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        creditBalance: 150, // 100 + 50
      },
    });

    console.log("✅ Updated user credit balance to 150\n");
    console.log("🎉 Test credits created successfully!");
    console.log("\nYou can now:");
    console.log("  - Test credit deduction: npm run test:deduction");
    console.log("  - View credits in UI: http://localhost:3000/credits");
    console.log("  - Check breakdown: http://localhost:3000/billing");

  } catch (error: any) {
    console.error("❌ Failed to create test credits:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCredits();

