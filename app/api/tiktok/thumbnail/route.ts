import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tiktok/thumbnail?url={tiktokVideoUrl}
 * Fetches TikTok video thumbnail using oEmbed API
 * Returns null if unable to fetch (TikTok API may be restricted)
 * 
 * ⚠️ PRODUCTION LIMITATION:
 * TikTok's oEmbed API frequently blocks server-side requests from production environments.
 * This is a known limitation of TikTok's API. The following approaches are recommended:
 * 
 * 1. **Cache thumbnails during import** (BEST): When importing trending products,
 *    fetch and store thumbnail URLs in the database during the import process.
 *    This avoids runtime fetching and works reliably in production.
 * 
 * 2. **Use a proxy service**: Route requests through a proxy service that rotates
 *    IPs to avoid blocking. This adds cost and complexity.
 * 
 * 3. **Client-side fetching**: Fetch thumbnails from the browser instead of server.
 *    However, TikTok may also block client-side requests with CORS.
 * 
 * 4. **Accept limitations**: Show placeholder images when thumbnails can't be fetched.
 *    This is the current approach and works but doesn't show actual thumbnails.
 * 
 * For now, this endpoint gracefully handles failures by returning null, which
 * causes the UI to show a placeholder instead of hanging on "Loading...".
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const videoUrl = searchParams.get("url");

    if (!videoUrl || !videoUrl.includes("tiktok.com")) {
      // Return success with null thumbnail instead of error
      return NextResponse.json({ thumbnailUrl: null });
    }

    // Use TikTok's oEmbed API to get thumbnail
    const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(
      videoUrl
    )}`;

    // Try with more realistic headers to avoid blocking
    const response = await fetch(oEmbedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.tiktok.com/",
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(8000), // 8 second timeout (increased for production)
    });

    if (!response.ok) {
      // TikTok API often returns 400/403/429 for various reasons
      // Log in production for debugging (can be removed later)
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[TikTok Thumbnail] API returned ${response.status} for URL: ${videoUrl.substring(0, 50)}...`);
      }
      return NextResponse.json({ thumbnailUrl: null });
    }

    const data = await response.json();
    
    // oEmbed response includes thumbnail_url
    const thumbnailUrl = data.thumbnail_url || null;

    if (!thumbnailUrl && process.env.NODE_ENV === 'production') {
      console.warn(`[TikTok Thumbnail] No thumbnail_url in oEmbed response for: ${videoUrl.substring(0, 50)}...`);
    }

    return NextResponse.json({ thumbnailUrl });
  } catch (error: any) {
    // Log errors in production for debugging
    if (process.env.NODE_ENV === 'production') {
      const videoUrl = request.nextUrl.searchParams.get("url") || "unknown";
      console.error(`[TikTok Thumbnail] Error fetching thumbnail for ${videoUrl.substring(0, 50)}...:`, {
        error: error?.message,
        name: error?.name,
        // Only log stack in development
        ...(process.env.NODE_ENV === 'development' && { stack: error?.stack }),
      });
    }
    
    // Return null so placeholder is shown instead
    return NextResponse.json({ thumbnailUrl: null });
  }
}

