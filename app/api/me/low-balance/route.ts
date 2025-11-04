import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { getUserById } from "@/lib/actions/user.actions";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user balance and threshold
    const userBalance = user.creditBalance || 0;
    const userThreshold = user.lowBalanceThreshold || 5; // Default threshold

    // Get org balance and threshold (if available)
    const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;
    let orgThreshold = userThreshold;
    
    if (orgId) {
      const orgCredits = await prisma.creditBalance.findUnique({
        where: { organizationId: orgId },
        select: {
          lowBalanceThreshold: true,
        },
      });
      if (orgCredits?.lowBalanceThreshold) {
        orgThreshold = orgCredits.lowBalanceThreshold;
      }
    }

    // Use the higher threshold (more conservative)
    const threshold = Math.max(userThreshold, orgThreshold);

    // Check if balance is low
    const isLow = userBalance < threshold;

    // Check if we've sent an email notification recently (within last 24 hours)
    let emailSent = false;
    if (isLow && orgId) {
      const recentEmail = await prisma.creditLedger.findFirst({
        where: {
          organizationId: orgId,
          reason: {
            contains: "Low balance email notification",
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      emailSent = !!recentEmail;
    }

    return NextResponse.json({
      isLow,
      currentBalance: userBalance,
      threshold,
      emailSent,
    });
  } catch (error) {
    console.error("Error checking low balance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

