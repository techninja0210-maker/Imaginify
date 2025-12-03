import { NextRequest, NextResponse } from "next/server"
import { getTrendingProducts } from "@/lib/actions/trending.actions"
import { auth } from "@clerk/nextjs"
import { prisma } from "@/lib/database/prisma"

export const dynamic = "force-dynamic"

// GET /api/trending/products
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = auth()
    const searchParams = request.nextUrl.searchParams

    // Convert Clerk ID to database user ID if user is logged in
    let databaseUserId: string | undefined = undefined
    if (clerkUserId) {
      try {
        const user = await prisma.user.findUnique({
          where: { clerkId: clerkUserId },
          select: { id: true }
        })
        if (user) {
          databaseUserId = user.id
        }
      } catch (error) {
        console.error("[TRENDING PRODUCTS] Error fetching user:", error)
        // Continue without userId if lookup fails
      }
    }

    // Get filters from query params
    const filters = {
      reportId: searchParams.get("reportId") || undefined,
      platform: (searchParams.get("platform") as "tiktok" | "amazon") || undefined,
      category: searchParams.get("category") || undefined,
      commissionMin: searchParams.get("commissionMin") ? parseFloat(searchParams.get("commissionMin")!) : undefined,
      commissionMax: searchParams.get("commissionMax") ? parseFloat(searchParams.get("commissionMax")!) : undefined,
      salesMin: searchParams.get("salesMin") ? parseInt(searchParams.get("salesMin")!) : undefined,
      salesMax: searchParams.get("salesMax") ? parseInt(searchParams.get("salesMax")!) : undefined,
      searchQuery: searchParams.get("search") || undefined,
      sortBy: (searchParams.get("sortBy") as any) || "rank",
      favoritesOnly: searchParams.get("favoritesOnly") === "true",
      userId: databaseUserId, // Use database user ID, not Clerk ID
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 100,
    }

    const products = await getTrendingProducts(filters)

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
    })
  } catch (error) {
    console.error("Error fetching trending products:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch trending products",
      },
      { status: 500 }
    )
  }
}

