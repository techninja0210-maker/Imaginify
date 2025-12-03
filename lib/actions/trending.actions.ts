"use server"

import { prisma } from "@/lib/database/prisma"
import { format } from "date-fns"

export interface TrendingProductFilters {
  reportId?: string
  platform?: "tiktok" | "amazon"
  category?: string
  commissionMin?: number
  commissionMax?: number
  salesMin?: number
  salesMax?: number
  searchQuery?: string
  sortBy?: "rank" | "sales" | "trending-up" | "trending-down"
  favoritesOnly?: boolean
  userId?: string
  limit?: number
}

export interface TrendingProductData {
  id: string
  rank: number
  productId: string
  productName: string
  displayImageUrl: string
  sales7d: number
  commission: string
  videoThumbnails: string[] | Array<{ url: string; thumbnailUrl: string | null }>
  isFavorite: boolean
  tiktokProductUrl: string
  amazonUrl?: string
  category?: string
}

// Fetch all available weekly reports for date range selector
export async function getWeeklyReports() {
  try {
    const reports = await prisma.weeklyReport.findMany({
      orderBy: {
        weekEndDate: "desc",
      },
      select: {
        id: true,
        weekStartDate: true,
        weekEndDate: true,
        label: true,
      },
    })

    return reports.map((report) => ({
      id: report.id,
      value: report.id,
      label: report.label || formatDateRange(report.weekStartDate, report.weekEndDate),
      weekStart: report.weekStartDate,
      weekEnd: report.weekEndDate,
    }))
  } catch (error) {
    console.error("Error fetching weekly reports:", error)
    return []
  }
}

// Get the most recent weekly report
export async function getLatestWeeklyReport() {
  try {
    const report = await prisma.weeklyReport.findFirst({
      orderBy: {
        weekEndDate: "desc",
      },
    })

    return report
  } catch (error) {
    console.error("Error fetching latest weekly report:", error)
    return null
  }
}

// Fetch trending products with filters
export async function getTrendingProducts(filters: TrendingProductFilters = {}) {
  try {
    const {
      reportId,
      platform,
      category,
      commissionMin,
      commissionMax,
      salesMin,
      salesMax,
      searchQuery,
      sortBy = "rank",
      favoritesOnly = false,
      userId,
      limit = 100,
    } = filters

    // Build where clause
    const where: any = {}

    // Filter by report/date range (required for trending products)
    if (!reportId) {
      console.warn("[getTrendingProducts] No reportId provided, returning empty array")
      return []
    }

    where.reportId = reportId

    // Get week stats with products
    let weekStats = await prisma.productWeekStat.findMany({
      where,
      include: {
        product: {
          include: {
            videos: {
              orderBy: {
                rankForProduct: "asc",
              },
              take: 3,
            },
            matches: {
              include: {
                amazon: true,
              },
              where: {
                chosen: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: {
        rankThisWeek: "asc",
      },
      take: limit,
    })

    // Apply filters
    let filteredStats = weekStats

    // Platform filter
    if (platform === "tiktok") {
      // Filter to only products with TikTok data
      filteredStats = filteredStats.filter((stat) => stat.tiktokSales7d != null && stat.tiktokSales7d > 0)
    } else if (platform === "amazon") {
      // Filter to only products with Amazon matches
      filteredStats = filteredStats.filter((stat) => stat.product.matches.length > 0)
    }

    // Sales filter
    if (salesMin !== undefined || salesMax !== undefined) {
      filteredStats = filteredStats.filter((stat) => {
        const sales = stat.tiktokSales7d || 0
        if (salesMin !== undefined && sales < salesMin) return false
        if (salesMax !== undefined && sales > salesMax) return false
        return true
      })
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filteredStats = filteredStats.filter((stat) =>
        stat.product.name.toLowerCase().includes(query)
      )
    }

    // Get user favorites if needed
    let favoriteProductIds: string[] = []
    if (favoritesOnly || userId) {
      favoriteProductIds = await getUserFavoriteProductIds(userId || "")
    }

    // Apply favorites filter
    if (favoritesOnly) {
      filteredStats = filteredStats.filter((stat) => favoriteProductIds.includes(stat.productId))
    }

    // Sort
    if (sortBy === "rank") {
      filteredStats.sort((a, b) => (a.rankThisWeek || 999) - (b.rankThisWeek || 999))
    } else if (sortBy === "sales") {
      filteredStats.sort((a, b) => (b.tiktokSales7d || 0) - (a.tiktokSales7d || 0))
    } else if (sortBy === "trending-up") {
      // Sort by sales descending (highest sales = trending up)
      filteredStats.sort((a, b) => (b.tiktokSales7d || 0) - (a.tiktokSales7d || 0))
    } else if (sortBy === "trending-down") {
      // Sort by sales ascending (lowest sales = trending down)
      filteredStats.sort((a, b) => (a.tiktokSales7d || 0) - (b.tiktokSales7d || 0))
    }

    // Get categories (extract from Amazon product if available)
    const categories = await getUniqueCategories(filteredStats.map((stat) => stat.productId))

    // Transform to ProductCard data format
    const products: TrendingProductData[] = filteredStats.map((stat, index) => {
      const amazonMatch = stat.product.matches[0]
      const amazonProduct = amazonMatch?.amazon
      
      // Extract category from Amazon product
      const productCategory = amazonProduct?.categoryPath
        ? (amazonProduct.categoryPath as string[])?.[0]
        : undefined

      // Get commission (default to 12% for now - this might need to come from TikTok API or metadata)
      // Note: Commission filtering is not implemented because all products currently have 12%
      // To enable commission filtering, commission data needs to be stored per product
      const commission = "12%"
      const commissionValue = 12 // Extract numeric value for filtering

      return {
        id: stat.id,
        rank: stat.rankThisWeek || index + 1,
        productId: stat.product.id,
        productName: stat.product.name,
        displayImageUrl: stat.product.displayImageUrl || "/img/product-placeholder.png",
        sales7d: stat.tiktokSales7d || 0,
        commission,
        commissionValue, // Add numeric value for filtering
        // Return video URLs with optional stored thumbnail URLs
        // Always return as objects for consistency, with thumbnailUrl null if not stored
        videoThumbnails: stat.product.videos.map((video) => ({
          url: video.url,
          thumbnailUrl: (video as any).thumbnailUrl || null,
        })),
        isFavorite: favoriteProductIds.includes(stat.product.id),
        tiktokProductUrl: stat.product.tiktokProductUrl,
        amazonUrl: amazonMatch ? amazonProduct?.productUrl || undefined : undefined,
        category: productCategory,
      }
    })

    // Apply commission filter (if implemented with real data)
    let filteredProducts = products
    if (commissionMin !== undefined || commissionMax !== undefined) {
      filteredProducts = filteredProducts.filter((p) => {
        const comm = (p as any).commissionValue || 12 // Default to 12% if not set
        if (commissionMin !== undefined && comm < commissionMin) return false
        if (commissionMax !== undefined && comm > commissionMax) return false
        return true
      })
    }

    // Apply category filter after extracting categories
    if (category && category !== "all") {
      filteredProducts = filteredProducts.filter((p) => p.category === category)
    }

    return filteredProducts
  } catch (error) {
    console.error("Error fetching trending products:", error)
    return []
  }
}

// Get unique categories from products
async function getUniqueCategories(productIds: string[]): Promise<string[]> {
  try {
    const products = await prisma.trendingProduct.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
      include: {
        matches: {
          include: {
            amazon: true,
          },
          where: {
            chosen: true,
          },
        },
      },
    })

    const categories = new Set<string>()
    products.forEach((product) => {
      product.matches.forEach((match) => {
        if (match.amazon?.categoryPath) {
          const categoryPath = match.amazon.categoryPath as string[]
          if (categoryPath[0]) {
            categories.add(categoryPath[0])
          }
        }
      })
    })

    return Array.from(categories).sort()
  } catch (error) {
    console.error("Error fetching categories:", error)
    return []
  }
}

// Get user's favorite product IDs
async function getUserFavoriteProductIds(userId: string): Promise<string[]> {
  if (!userId) return []

  try {
    const favorites = await prisma.userFavoriteProduct.findMany({
      where: {
        userId,
      },
      select: {
        productId: true,
      },
    })

    return favorites.map((f) => f.productId)
  } catch (error) {
    // If table doesn't exist yet, return empty array
    return []
  }
}

// Toggle favorite status
export async function toggleFavoriteProduct(userId: string, productId: string) {
  try {
    const existing = await prisma.userFavoriteProduct.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    })

    if (existing) {
      await prisma.userFavoriteProduct.delete({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      })
      return { isFavorite: false }
    } else {
      await prisma.userFavoriteProduct.create({
        data: {
          userId,
          productId,
        },
      })
      return { isFavorite: true }
    }
  } catch (error) {
    console.error("Error toggling favorite:", error)
    throw error
  }
}

// Helper function to format date range
function formatDateRange(start: Date, end: Date): string {
  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`
}

