/**
 * Cron job to clean up expired credit grants
 * Should be called daily to mark expired grants as fully used
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { cleanupExpiredGrants } from "@/lib/services/credit-grants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Verify cron secret (if you have one)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[CRON] Starting expired credit cleanup...");

    // Use the cleanup function from credit-grants service
    const result = await cleanupExpiredGrants();

    console.log(`[CRON] Cleanup completed: ${result.expiredCount} grants expired`);

    return NextResponse.json({
      success: true,
      expiredCount: result.expiredCount,
      message: `Marked ${result.expiredCount} expired credit grants as fully used`,
    });
  } catch (error: any) {
    console.error("[CRON] Error cleaning up expired credits:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to cleanup expired credits",
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET() {
  try {
    const result = await cleanupExpiredGrants();
    return NextResponse.json({
      success: true,
      expiredCount: result.expiredCount,
      message: `Marked ${result.expiredCount} expired credit grants as fully used`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to cleanup expired credits",
      },
      { status: 500 }
    );
  }
}


