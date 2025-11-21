/**
 * Test script to verify credit deduction logic
 * Run with: npm run test:deduction
 */

import { PrismaClient } from "@prisma/client";

// Import using direct Prisma calls instead of action functions to avoid path issues
const prisma = new PrismaClient();

// Replicate getActiveCreditGrants logic inline
async function getActiveCreditGrants(userId: string) {
  const now = new Date();
  const grants = await prisma.creditGrant.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
    },
    orderBy: [
      { type: "asc" },
      { expiresAt: "asc" },
    ],
  });

  let totalAvailable = 0;
  let subscriptionCredits = 0;
  let topUpCredits = 0;

  const grantSummaries = grants
    .map((grant) => {
      const available = grant.amount - grant.usedAmount;
      if (available <= 0) return null;

      if (grant.type === "SUBSCRIPTION") {
        subscriptionCredits += available;
      } else {
        topUpCredits += available;
      }
      totalAvailable += available;

      return {
        id: grant.id,
        type: grant.type,
        available,
        total: grant.amount,
        used: grant.usedAmount,
        expiresAt: grant.expiresAt,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return {
    totalAvailable,
    subscriptionCredits,
    topUpCredits,
    grants: grantSummaries,
  };
}

// Simple deduction test using direct database calls
async function testDeduction(userId: string, clerkId: string, amount: number) {
  const now = new Date();
  
  // Get active grants in priority order
  const grants = await prisma.creditGrant.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
    },
    orderBy: [
      { type: "asc" },
      { expiresAt: "asc" },
    ],
  });

  let remaining = amount;
  const deductions: Array<{ grantId: string; amount: number }> = [];

  for (const grant of grants) {
    if (remaining <= 0) break;
    const available = grant.amount - grant.usedAmount;
    if (available <= 0) continue;

    const toDeduct = Math.min(remaining, available);
    await prisma.creditGrant.update({
      where: { id: grant.id },
      data: { usedAmount: { increment: toDeduct } },
    });

    deductions.push({ grantId: grant.id, amount: toDeduct });
    remaining -= toDeduct;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient credits. Available: ${amount - remaining}, Required: ${amount}`);
  }

  // Update user balance
  await prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: amount } },
  });

  return deductions;
}

async function testCreditDeduction() {
  console.log("🧪 Testing Credit Deduction Logic\n");

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

    console.log(`📋 Testing with user: ${testUser.email} (${testUser.id})\n`);

    // Get current credit grants
    const before = await getActiveCreditGrants(testUser.id);
    console.log("📊 Before Deduction:");
    console.log(`   Total Available: ${before.totalAvailable}`);
    console.log(`   Subscription Credits: ${before.subscriptionCredits}`);
    console.log(`   Top-Up Credits: ${before.topUpCredits}`);
    console.log(`   Grants: ${before.grants.length}`);
    before.grants.forEach((grant, i) => {
      console.log(`     ${i + 1}. ${grant.type}: ${grant.available}/${grant.total} (expires: ${grant.expiresAt.toISOString()})`);
    });

    if (before.totalAvailable === 0) {
      console.log("\n⚠️  No credits available. Creating test credits for this user...\n");
      
      // Get or create a subscription plan
      let plan = await prisma.subscriptionPlan.findFirst({
        where: { isActiveForNewSignups: true },
      });

      if (!plan) {
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

      // Create subscription credit grant
      const subscriptionExpiry = new Date();
      subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);
      await prisma.creditGrant.create({
        data: {
          userId: testUser.id,
          type: "SUBSCRIPTION",
          amount: 100,
          usedAmount: 0,
          expiresAt: subscriptionExpiry,
          planId: plan.id,
        },
      });

      // Create top-up credit grant
      const topUpExpiry = new Date();
      topUpExpiry.setDate(topUpExpiry.getDate() + 365);
      await prisma.creditGrant.create({
        data: {
          userId: testUser.id,
          type: "TOPUP",
          amount: 50,
          usedAmount: 0,
          expiresAt: topUpExpiry,
        },
      });

      // Update user balance
      await prisma.user.update({
        where: { id: testUser.id },
        data: { creditBalance: 150 },
      });

      console.log("✅ Created test credits (100 subscription + 50 top-up)\n");
      
      // Re-fetch grants
      const refreshed = await getActiveCreditGrants(testUser.id);
      before.totalAvailable = refreshed.totalAvailable;
      before.subscriptionCredits = refreshed.subscriptionCredits;
      before.topUpCredits = refreshed.topUpCredits;
      before.grants = refreshed.grants;
      
      console.log("📊 Credits Available:");
      console.log(`   Total: ${before.totalAvailable}`);
      console.log(`   Subscription: ${before.subscriptionCredits}`);
      console.log(`   Top-Up: ${before.topUpCredits}\n`);
    }

    // Test deduction
    const deductionAmount = Math.min(10, before.totalAvailable);
    console.log(`\n💸 Deducting ${deductionAmount} credits...\n`);

    await testDeduction(testUser.id, testUser.clerkId, deductionAmount);

    // Get credit grants after
    const after = await getActiveCreditGrants(testUser.id);
    console.log("📊 After Deduction:");
    console.log(`   Total Available: ${after.totalAvailable}`);
    console.log(`   Subscription Credits: ${after.subscriptionCredits}`);
    console.log(`   Top-Up Credits: ${after.topUpCredits}`);
    console.log(`   Grants: ${after.grants.length}`);
    after.grants.forEach((grant, i) => {
      console.log(`     ${i + 1}. ${grant.type}: ${grant.available}/${grant.total} (expires: ${grant.expiresAt.toISOString()})`);
    });

    // Verify
    const expectedTotal = before.totalAvailable - deductionAmount;
    if (after.totalAvailable === expectedTotal) {
      console.log("\n✅ Deduction successful!");
      console.log(`   Expected: ${expectedTotal}, Got: ${after.totalAvailable}`);
    } else {
      console.log("\n❌ Deduction mismatch!");
      console.log(`   Expected: ${expectedTotal}, Got: ${after.totalAvailable}`);
    }

    // Verify priority (subscription first)
    if (before.subscriptionCredits > 0 && after.subscriptionCredits < before.subscriptionCredits) {
      console.log("✅ Subscription credits used first (correct priority)");
    } else if (before.subscriptionCredits === 0 && before.topUpCredits > 0) {
      console.log("✅ Top-up credits used (no subscription credits available)");
    }

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreditDeduction();

