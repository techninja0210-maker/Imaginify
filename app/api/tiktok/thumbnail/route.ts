import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache to avoid duplicate requests for the same URL
const thumbnailCache = new Map<string, { thumbnailUrl: string | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for successful fetches
const FAILED_CACHE_TTL = 60 * 60 * 1000; // 1 hour for failed fetches (reduce redundant API calls)
const MAX_CACHE_SIZE = 1000; // Limit cache size

// Track ongoing requests to deduplicate simultaneous requests for the same URL
const pendingRequests = new Map<string, Promise<{ thumbnailUrl: string | null }>>();

/**
 * GET /api/tiktok/thumbnail?url={tiktokVideoUrl}
 * Fetches TikTok video thumbnail using oEmbed API
 * Returns null if unable to fetch (TikTok API may be restricted)
 * 
 * Features:
 * - Request deduplication: Multiple simultaneous requests for the same URL share one fetch
 * - In-memory cache: Caches results for 5 minutes to reduce API calls
 * - Error suppression: Expected errors are handled silently
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

    // Check cache first
    // Use longer cache TTL for failed requests to reduce redundant API calls
    const cached = thumbnailCache.get(videoUrl);
    if (cached) {
      const cacheAge = Date.now() - cached.timestamp;
      const isFailed = cached.thumbnailUrl === null;
      const ttl = isFailed ? FAILED_CACHE_TTL : CACHE_TTL;
      
      if (cacheAge < ttl) {
        return NextResponse.json({ thumbnailUrl: cached.thumbnailUrl });
      }
    }

    // Check if there's already a pending request for this URL
    const pendingRequest = pendingRequests.get(videoUrl);
    if (pendingRequest) {
      // Wait for the existing request instead of creating a new one
      return pendingRequest.then(result => NextResponse.json(result));
    }

    // Create new request
    const fetchPromise = (async () => {
      try {
        // Use TikTok's oEmbed API to get thumbnail
        const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;

        // Try with more realistic headers to avoid blocking
        const response = await fetch(oEmbedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.tiktok.com/",
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(8000), // 8 second timeout
        });

        let thumbnailUrl: string | null = null;

        if (response.ok) {
          const data = await response.json();
          thumbnailUrl = data.thumbnail_url || null;
          
          // Log successful fetches in development for debugging
          if (thumbnailUrl && process.env.NODE_ENV === 'development') {
            console.log(`[TikTok Thumbnail] ✅ Successfully fetched thumbnail for ${videoUrl.substring(0, 50)}...`);
          }
        } else {
          // TikTok API often returns 400/403/429 - log status in development only
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[TikTok Thumbnail] API returned ${response.status} for ${videoUrl.substring(0, 50)}...`);
          }
        }

        // Cache the result (even if null, to avoid repeated failures)
        if (thumbnailCache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entries (simple FIFO eviction)
          const firstKey = thumbnailCache.keys().next().value;
          if (firstKey) thumbnailCache.delete(firstKey);
        }
        thumbnailCache.set(videoUrl, { thumbnailUrl, timestamp: Date.now() });

        return { thumbnailUrl };
      } catch (error: any) {
        // Most TikTok fetch failures are expected (API blocking, network issues, etc.)
        // Don't log expected errors to reduce console noise
        const errorMessage = error?.message || String(error);
        const errorName = error?.name || '';
        
        // These are all expected errors - don't log them
        const isExpectedError = 
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('AbortError') ||
          errorName === 'AbortError' ||
          errorName === 'TypeError';
        
        // Log errors in development for debugging (suppress in production)
        if (process.env.NODE_ENV === 'development') {
          if (isExpectedError) {
            // Log expected errors briefly in dev
            console.warn(`[TikTok Thumbnail] Expected error (fetch failed) for ${videoUrl.substring(0, 50)}...`);
          } else {
            console.warn(`[TikTok Thumbnail] Unexpected error for ${videoUrl.substring(0, 50)}...: ${errorMessage}`);
          }
        }
        
        // Cache null result to avoid repeated failures
        if (thumbnailCache.size >= MAX_CACHE_SIZE) {
          const firstKey = thumbnailCache.keys().next().value;
          if (firstKey) thumbnailCache.delete(firstKey);
        }
        thumbnailCache.set(videoUrl, { thumbnailUrl: null, timestamp: Date.now() });
        
        return { thumbnailUrl: null };
      } finally {
        // Remove from pending requests
        pendingRequests.delete(videoUrl);
      }
    })();

    // Store the promise so other requests can await it
    pendingRequests.set(videoUrl, fetchPromise);

    const result = await fetchPromise;
    return NextResponse.json(result);
  } catch (error: any) {
    // This outer catch should rarely be hit, but handle it gracefully
    const videoUrl = request.nextUrl.searchParams.get("url") || "unknown";
    
    // Only log if it's truly unexpected (not a fetch error)
    const errorMessage = error?.message || String(error);
    if (!errorMessage.includes('fetch failed') && process.env.NODE_ENV === 'development') {
      console.warn(`[TikTok Thumbnail] Outer error handler: ${errorMessage}`);
    }
    
    // Return null so placeholder is shown instead
    return NextResponse.json({ thumbnailUrl: null });
  }
}
