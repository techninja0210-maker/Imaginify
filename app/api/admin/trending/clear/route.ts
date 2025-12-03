import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/trending/clear
 * Delete all trending products data
 * This will delete:
 * - User favorites
 * - Trending videos
 * - Product Amazon matches
 * - Product week stats
 * - Trending products
 * - Import logs
 * - Weekly reports
 */
export async function POST() {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("🗑️  Starting cleanup of trending products data...");

    // Delete in correct order to respect foreign key constraints
    const deletedFavorites = await prisma.userFavoriteProduct.deleteMany({});
    const deletedVideos = await prisma.trendingVideo.deleteMany({});
    const deletedMatches = await prisma.productAmazonMatch.deleteMany({});
    const deletedStats = await prisma.productWeekStat.deleteMany({});
    const deletedProducts = await prisma.trendingProduct.deleteMany({});
    const deletedLogs = await prisma.trendingImportLog.deleteMany({});
    const deletedReports = await prisma.weeklyReport.deleteMany({});

    const summary = {
      favorites: deletedFavorites.count,
      videos: deletedVideos.count,
      amazonMatches: deletedMatches.count,
      weekStats: deletedStats.count,
      products: deletedProducts.count,
      importLogs: deletedLogs.count,
      weeklyReports: deletedReports.count,
    };

    console.log("✅ Cleanup completed successfully!", summary);

    return NextResponse.json({
      success: true,
      message: "All trending products data has been cleared",
      summary,
    });
  } catch (error: any) {
    console.error("[POST /api/admin/trending/clear] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || "Failed to clear trending products data",
      },
      { status: error?.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

