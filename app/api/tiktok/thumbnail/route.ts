import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tiktok/thumbnail?url={tiktokVideoUrl}
 * Fetches TikTok video thumbnail using oEmbed API
 * Returns null if unable to fetch (TikTok API may be restricted)
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

    const response = await fetch(oEmbedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      // TikTok API often returns 400/403/429 for various reasons
      // Silently fail and return null - placeholder will be shown instead
      return NextResponse.json({ thumbnailUrl: null });
    }

    const data = await response.json();
    
    // oEmbed response includes thumbnail_url
    const thumbnailUrl = data.thumbnail_url || null;

    return NextResponse.json({ thumbnailUrl });
  } catch (error: any) {
    // Silently handle errors - TikTok API is often unavailable/blocked
    // This is expected behavior - TikTok frequently blocks oEmbed requests
    // No need to log as it's handled gracefully with placeholder images
    // Return null so placeholder is shown instead
    
    return NextResponse.json({ thumbnailUrl: null });
  }
}

