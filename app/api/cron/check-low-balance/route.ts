import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { sendLowBalanceEmail } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint to check all users with low balances and send email notifications
 * 
 * To configure:
 * 1. Add this to your cron service (Vercel Cron, cron-job.org, etc.)
 * 2. Set it to run hourly or every 6 hours
 * 
 * Example Vercel cron.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-low-balance",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 */
export async function POST(request: Request) {
  try {
    // Verify this is coming from a cron service (optional but recommended)
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting low balance check...");

    // Find all users with organizations
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
      },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                credits: true,
              },
            },
          },
        },
      },
      take: 1000, // Process in batches if you have more users
    });

    console.log(`[Cron] Found ${users.length} users to check`);

    const results = {
      checked: 0,
      notified: 0,
      skipped: 0,
      errors: 0,
    };

    for (const user of users) {
      try {
        results.checked++;

        // Check if user has low balance
        const userBalance = user.creditBalance || 0;
        const userThreshold = user.lowBalanceThreshold || 5;

        // Get org threshold
        const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;
        let orgThreshold = userThreshold;

        if (orgId && user.organizationMembers[0]?.organization?.credits?.lowBalanceThreshold) {
          orgThreshold = user.organizationMembers[0].organization.credits.lowBalanceThreshold;
        }

        const threshold = Math.max(userThreshold, orgThreshold);

        // Only notify if balance is below threshold
        if (userBalance >= threshold) {
          results.skipped++;
          continue;
        }

        // Send email notification
        const result = await sendLowBalanceEmail(user.clerkId);
        if (result.sent) {
          results.notified++;
          console.log(`[Cron] Notified user ${user.email} (balance: ${userBalance}, threshold: ${threshold})`);
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.errors++;
        console.error(`[Cron] Error checking user ${user.email}:`, error);
      }
    }

    console.log("[Cron] Low balance check complete:", results);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Error in low balance check:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual testing (remove in production)
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  // Run the same logic as POST
  return POST(new Request("http://localhost", { method: "POST" }));
}

