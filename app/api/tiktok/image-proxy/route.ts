import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tiktok/image-proxy?url={imageUrl}
 * 
 * Proxies TikTok CDN images to handle expired URLs and CORS issues.
 * When a TikTok CDN URL is expired, this endpoint can:
 * 1. Attempt to refresh it (if possible)
 * 2. Return a placeholder if refresh fails
 * 3. Handle CORS issues by serving the image through our domain
 * 
 * This is necessary because TikTok CDN URLs contain signed parameters
 * (x-expires, x-signature) that expire after a certain time.
 */

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 }
      );
    }

    // Only proxy TikTok CDN URLs
    if (!imageUrl.includes("tiktokcdn") && !imageUrl.includes("tiktok.com")) {
      // For non-TikTok URLs, redirect to the original URL
      return NextResponse.redirect(imageUrl);
    }

    // Try to fetch the image
    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.tiktok.com/",
          "Accept": "image/*",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();
        
        // Determine content type from response or default to jpeg
        const contentType = response.headers.get("content-type") || "image/jpeg";

        return new NextResponse(imageBuffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", // Cache for 1 hour
          },
        });
      } else if (response.status === 403 || response.status === 404) {
        // URL expired or not found - return 404 with special header to indicate expiration
        console.warn(`[TikTok Image Proxy] URL expired/not found (${response.status}): ${imageUrl.substring(0, 100)}`);
        
        // Return 404 JSON response instead of image so Image component's onError fires
        // This allows the client to detect the failure and fetch a fresh thumbnail
        return NextResponse.json(
          { error: "Image expired or not available", expired: true },
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300", // Cache 404s for 5 minutes
              "X-Image-Expired": "true", // Custom header to identify expired images
            },
          }
        );
      } else {
        // Other error status
        console.warn(`[TikTok Image Proxy] Failed to fetch image (${response.status}): ${imageUrl.substring(0, 100)}`);
        
        // Return 404 JSON so onError fires
        return NextResponse.json(
          { error: "Failed to fetch image", status: response.status },
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300",
            },
          }
        );
      }
    } catch (fetchError: any) {
      // Network error or timeout
      console.warn(`[TikTok Image Proxy] Fetch error: ${fetchError?.message || fetchError}`);
      
      // Return JSON error so Image component's onError fires
      return NextResponse.json(
        { error: "Network error or timeout", expired: false },
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
            "X-Image-Expired": "false",
          },
        }
      );
    }
  } catch (error: any) {
    console.error(`[TikTok Image Proxy] Unexpected error: ${error?.message || error}`);
    
    // Return JSON error so Image component's onError fires
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );
  }
}

