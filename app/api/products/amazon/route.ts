import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/products/amazon
 * Get Amazon products (for viewing ingestion results)
 * 
 * Query params:
 * - limit: number (default: 20, max: 100)
 * - page: number (default: 1)
 * - asin: string (optional, filter by ASIN)
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const page = Number(searchParams.get("page")) || 1;
    const asin = searchParams.get("asin") || undefined;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (asin) {
      where.asin = asin;
    }

    const [products, total] = await Promise.all([
      prisma.amazonProduct.findMany({
        where,
        orderBy: {
          updatedAt: "desc",
        },
        take: limit,
        skip,
        select: {
          asin: true,
          title: true,
          brand: true,
          salePrice: true,
          currency: true,
          averageRating: true,
          totalRatings: true,
          mainImageUrl: true,
          productUrl: true,
          scrapedAt: true,
          createdAt: true,
          updatedAt: true,
          isPrime: true,
          isAmazonChoice: true,
          isBestSeller: true,
        },
      }),
      prisma.amazonProduct.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[GET /api/products/amazon] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to fetch Amazon products",
      },
      { status: 500 }
    );
  }
}


