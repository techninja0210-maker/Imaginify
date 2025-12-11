import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { extractTikTokVideoId } from "@/lib/utils/tiktok-thumbnail";

export const dynamic = "force-dynamic";

/**
 * GET /api/tiktok/[tiktokId]
 * Fetches TikTok video details with product information
 * Enforces v1 scope: only returns videos from trending products
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tiktokId: string }> }
) {
  try {
    const { tiktokId } = await params;

    // Validate tiktokId is numeric (TikTok video IDs are numeric)
    if (!tiktokId || !/^\d+$/.test(tiktokId)) {
      return NextResponse.json(
        { success: false, error: "Invalid TikTok video ID" },
        { status: 400 }
      );
    }

    // Find video by matching URL pattern (v1 scope: must be in trending products)
    const video = await prisma.trendingVideo.findFirst({
      where: {
        url: {
          contains: `/video/${tiktokId}`,
        },
      },
      include: {
        product: {
          include: {
            matches: {
              where: {
                chosen: true,
              },
              include: {
                amazon: true,
              },
              take: 1,
            },
            weekStats: {
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
            },
          },
        },
      },
    });

    // Enforce v1 scope: video must exist in trending products
    if (!video) {
      return NextResponse.json(
        {
          success: false,
          error: "Video not found in trending products",
        },
        { status: 404 }
      );
    }

    // Extract creator handle from TikTok URL
    const creatorHandle = extractCreatorHandle(video.url);
    
    // Get latest week stats for metrics
    const latestStats = video.product.weekStats[0];
    const amazonMatch = video.product.matches[0];
    const amazonProduct = amazonMatch?.amazon;

    // Get thumbnail URL from video record
    const thumbnailUrl = (video as any).thumbnailUrl || null;
    
    // Extract creator handle with better fallback
    let finalCreatorHandle = creatorHandle;
    if (!finalCreatorHandle || finalCreatorHandle === "@") {
      // Try alternative extraction methods
      const urlMatch = video.url.match(/@([^/\s]+)/);
      if (urlMatch && urlMatch[1]) {
        finalCreatorHandle = `@${urlMatch[1]}`;
      } else {
        // If still no handle, try to extract from URL path
        const pathParts = video.url.split('/');
        const userIndex = pathParts.findIndex(part => part.startsWith('@'));
        if (userIndex >= 0 && pathParts[userIndex]) {
          finalCreatorHandle = pathParts[userIndex];
        } else {
          finalCreatorHandle = null; // Will show as empty instead of "Unknown"
        }
      }
    }
    
    // Build response with available data (graceful degradation for missing data)
    const response = {
      success: true,
      tiktok_id: tiktokId,
      tiktok_url: video.url,
      thumbnail_url: thumbnailUrl, // Add thumbnail URL for preview
      product: {
        title: video.product.name,
        // Prioritize Amazon product image if available
        image_url: amazonProduct?.mainImageUrl 
          || video.product.displayImageUrl 
          || "/img/product-placeholder.png",
        category: amazonProduct?.categoryPath
          ? (amazonProduct.categoryPath as string[])?.[0]
          : undefined,
      },
      creator: {
        handle: finalCreatorHandle || null, // Return null instead of "Unknown"
        avatar_url: undefined, // Not available in v1
      },
      metrics: {
        // Use available data, show null for unavailable metrics
        gmv: null, // Not available in current schema
        units_sold: latestStats?.tiktokSales7d || null,
        orders: null, // Not available in current schema
        views: null, // Not available in current schema
        clicks: null, // Not available in current schema
        ctr: null, // Not available in current schema
        conversion_rate: null, // Not available in current schema
      },
      price: {
        current: latestStats?.snapshotPriceCents
          ? latestStats.snapshotPriceCents / 100
          : null,
        currency: "USD",
        original: null, // Not available in current schema
        discount_percent: null, // Not available in current schema
      },
      amazon_match: {
        has_match: !!amazonMatch && !!amazonProduct,
        asin: amazonMatch?.asin || amazonProduct?.asin || undefined,
        amazon_url: amazonProduct?.productUrl 
          || amazonProduct?.canonicalUrl 
          || (amazonProduct?.asin ? `https://www.amazon.com/dp/${amazonProduct.asin}` : undefined),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[TIKTOK API] Error fetching video:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch video details",
      },
      { status: 500 }
    );
  }
}

/**
 * Extract creator handle from TikTok URL
 * Examples:
 * - https://www.tiktok.com/@lake_life_loto2/video/1234567890 -> @lake_life_loto2
 * - https://vm.tiktok.com/ABC123/ -> null (no handle in short URLs)
 * - https://www.tiktok.com/@user123 -> @user123
 */
function extractCreatorHandle(url: string): string | null {
  if (!url) return null;
  
  // Remove query params and fragments
  const cleanUrl = url.split('?')[0].split('#')[0];
  
  // Try multiple patterns
  // Pattern 1: @username in path (most common)
  const match1 = cleanUrl.match(/@([^/\s?]+)/);
  if (match1 && match1[1] && match1[1] !== 'video') {
    return `@${match1[1]}`;
  }
  
  // Pattern 2: Check if URL contains /@/ pattern
  const match2 = cleanUrl.match(/\/(@[^/\s?]+)/);
  if (match2 && match2[1]) {
    return match2[1];
  }
  
  // Pattern 3: Extract from path segments
  const urlObj = new URL(cleanUrl);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  const userIndex = pathParts.findIndex(part => part.startsWith('@'));
  if (userIndex >= 0 && pathParts[userIndex]) {
    const handle = pathParts[userIndex];
    if (handle.length > 1) { // More than just "@"
      return handle;
    }
  }
  
  return null;
}
