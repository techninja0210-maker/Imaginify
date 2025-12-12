"use client";

import Image from "next/image";
import { Spinner, Loader } from "./Loader";
import Link from "next/link";
import { Heart, TrendingUp, Play } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { extractTikTokVideoId } from "@/lib/utils/tiktok-thumbnail";

interface ProductCardProps {
  rank: number;
  productId: string;
  productName: string;
  displayImageUrl: string;
  sales7d: number;
  commission: string;
  videoThumbnails?: string[] | Array<{ url: string; thumbnailUrl: string | null }>;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  amazonUrl?: string;
}

// Helper function to check if URL is a valid image URL
function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (url.startsWith("/")) return true; // Local path
  
  // Reject TikTok video URLs (but allow TikTok image CDN URLs if they exist)
  if (url.includes("tiktok.com") && !url.includes("image") && !url.includes("thumbnail")) {
    return false; // TikTok video URLs are not images
  }
  
  // Accept Amazon image URLs (they often don't have extensions)
  if (url.includes("amazon.com") || url.includes("media-amazon.com")) {
    return true;
  }
  
  // Accept common image CDN patterns
  if (url.includes("cdn") || url.includes("images") || url.includes("img")) {
    // Check if it looks like an image URL (has image-related path segments)
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("/image") || lowerUrl.includes("/img") || lowerUrl.includes("/photo") || lowerUrl.includes("/picture")) {
      return true;
    }
  }
  
  // Check for common image extensions
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"];
  if (imageExtensions.some((ext) => url.toLowerCase().includes(ext))) {
    return true;
  }
  
  // If URL starts with http/https and doesn't match known non-image patterns, allow it
  // This is more permissive but handles edge cases
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // Reject known non-image patterns
    const nonImagePatterns = ["/video/", "/watch", "youtube.com", "vimeo.com"];
    if (!nonImagePatterns.some(pattern => url.toLowerCase().includes(pattern))) {
      return true; // Assume it's an image if it's a valid HTTP URL
    }
  }
  
  return false;
}

export default function ProductCard({
  rank,
  productName,
  displayImageUrl,
  sales7d,
  commission,
  videoThumbnails = [],
  isFavorite = false,
  onFavoriteToggle,
  amazonUrl,
}: ProductCardProps) {
  const [isFav, setIsFav] = useState(isFavorite);
  const [imageError, setImageError] = useState(false);
  const [thumbnailErrors, setThumbnailErrors] = useState<
    Record<number, boolean>
  >({});
  const [tiktokThumbnails, setTiktokThumbnails] = useState<
    Record<number, string | null>
  >({});
  const [tiktokFetchComplete, setTiktokFetchComplete] = useState<
    Record<number, boolean>
  >({});
  const fetchedRef = useRef<Set<string>>(new Set()); // Track which video URLs we've fetched
  const failedFetchesRef = useRef<Set<string>>(new Set()); // Track which URLs have failed (don't retry)
  const retryAttemptsRef = useRef<Map<string, number>>(new Map()); // Track retry attempts per URL
  
  // Load failed fetches from sessionStorage on mount to prevent redundant API calls
  useEffect(() => {
    try {
      const storedFailed = sessionStorage.getItem('tiktok_failed_thumbnails');
      if (storedFailed) {
        const failed = JSON.parse(storedFailed) as string[];
        failed.forEach(url => failedFetchesRef.current.add(url));
      }
    } catch (e) {
      // Ignore errors - sessionStorage might not be available
    }
  }, []);

  const handleFavoriteClick = () => {
    setIsFav(!isFav);
    onFavoriteToggle?.();
  };

  // Format sales number with commas
  const formatSales = (sales: number) => {
    return sales.toLocaleString();
  };

  // Get safe image URL - use placeholder if invalid
  // For TikTok CDN URLs, route through our proxy to handle expired URLs
  const getSafeImageUrl = (
    url: string | undefined | null,
    fallback: string = "/img/product-placeholder.png"
  ) => {
    if (!url || !isValidImageUrl(url)) return fallback;
    
    // Route TikTok CDN URLs through our proxy to handle expired signatures
    if (url.includes("tiktokcdn") || (url.includes("tiktok.com") && url.includes("image"))) {
      return `/api/tiktok/image-proxy?url=${encodeURIComponent(url)}`;
    }
    
    return url;
  };

  // Process video thumbnails - use stored thumbnails first, fetch if needed
  useEffect(() => {
    console.log('[ProductCard] videoThumbnails prop:', videoThumbnails);
    
    if (!videoThumbnails || videoThumbnails.length === 0) {
      console.log('[ProductCard] No video thumbnails to process for product:', productName);
      return;
    }

    console.log('[ProductCard] Processing', videoThumbnails.length, 'video thumbnails for product:', productName);

    const processThumbnails = async () => {
      // Normalize videoThumbnails to array of objects with url and optional thumbnailUrl
      const normalizedVideos = videoThumbnails.map((item) => {
        if (typeof item === 'string') {
          return { url: item, thumbnailUrl: null };
        }
        return item;
      });

      // For TikTok videos, ALWAYS fetch fresh thumbnails via oEmbed API (no proxy, direct URLs)
      // Stored TikTok CDN URLs expire quickly (403 errors) - completely ignore them
      // For non-TikTok videos, use stored thumbnails if available
      const promises = normalizedVideos.map(async (video, index) => {
        const videoUrl = video.url;
        const storedThumbnail = video.thumbnailUrl;

        // For non-TikTok videos, use stored thumbnail if available
        if (!videoUrl?.includes("tiktok.com")) {
          if (storedThumbnail && isValidImageUrl(storedThumbnail)) {
            setTiktokThumbnails((prev) => ({
              ...prev,
              [index]: storedThumbnail,
            }));
          }
          // Mark non-TikTok videos as complete
          setTiktokFetchComplete((prev) => ({
            ...prev,
            [index]: true,
          }));
          return;
        }

        // For TikTok videos, ALWAYS fetch fresh thumbnails (completely ignore stored ones)
        // Don't set stored thumbnails at all - they're expired and cause 403 errors
        // This matches the behavior of the TikTok detail page (direct URLs, no proxy)

        // Skip if we've already fetched OR if this URL has previously failed
        // This prevents excessive API calls and retry loops
        if (fetchedRef.current.has(videoUrl) || failedFetchesRef.current.has(videoUrl)) {
          // If already fetched successfully, no need to do anything
          // If previously failed, skip to avoid repeated failures
          return;
        }

        fetchedRef.current.add(videoUrl); // Mark as fetching to prevent duplicates
          
        try {
          const response = await fetch(
            `/api/tiktok/thumbnail?url=${encodeURIComponent(videoUrl)}`,
            {
              // Add timeout to prevent hanging
              signal: AbortSignal.timeout(10000), // 10 second timeout
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          // Mark as complete whether we got a thumbnail or not
          setTiktokFetchComplete((prev) => ({
            ...prev,
            [index]: true,
          }));

          // API returns null on failure - this is expected
          if (data.thumbnailUrl) {
            // Successfully fetched thumbnail
            setTiktokThumbnails((prev) => ({
              ...prev,
              [index]: data.thumbnailUrl,
            }));
          } else {
            // No thumbnail available - mark as failed to prevent retries
            failedFetchesRef.current.add(videoUrl);
            // Store in sessionStorage to persist across page reloads
            try {
              const stored = Array.from(failedFetchesRef.current);
              sessionStorage.setItem('tiktok_failed_thumbnails', JSON.stringify(stored));
            } catch (e) {
              // Ignore sessionStorage errors
            }
            setTiktokThumbnails((prev) => ({
              ...prev,
              [index]: null,
            }));
          }
        } catch (error) {
          // Mark as failed to prevent repeated retries
          failedFetchesRef.current.add(videoUrl);
          // Store in sessionStorage to persist across page reloads
          try {
            const stored = Array.from(failedFetchesRef.current);
            sessionStorage.setItem('tiktok_failed_thumbnails', JSON.stringify(stored));
          } catch (e) {
            // Ignore sessionStorage errors
          }
          
          // Mark as complete even on error - stop showing loading
          setTiktokFetchComplete((prev) => ({
            ...prev,
            [index]: true,
          }));
          
          // Set thumbnail to null to stop loading indicator
          setTiktokThumbnails((prev) => ({
            ...prev,
            [index]: null,
          }));
          
          // Silently handle - placeholder will be shown instead
          // No need to log - these failures are expected for TikTok API
        }
      });
      await Promise.all(promises);
    };

    processThumbnails();
    // Only re-run if the video URLs actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoThumbnails.map(v => typeof v === 'string' ? v : v.url).join(",")]);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
      {/* Top Section: Rank, Favorite, Main Image */}
      <div className="p-5 sm:p-4">
        {/* Rank Badge */}
        <div className="flex items-center justify-between rounded-lg">
          <span className="text-sm font-semibold text-gray-900">#{rank}</span>

          {/* Favorite Button */}
          <button
            onClick={handleFavoriteClick}
            className="right-3 z-10 p-2 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white transition-colors"
            aria-label="Toggle favorite"
          >
            <Heart
              className={`w-5 h-5 ${
                isFav ? "fill-red-500 text-red-500" : "text-gray-400"
              }`}
            />
          </button>
        </div>

        {/* Main Product Image */}
        <div className="w-full aspect-[4/3] relative bg-gray-100 overflow-hidden rounded-xl">
          {!imageError && isValidImageUrl(displayImageUrl) ? (
            <Image
              src={getSafeImageUrl(displayImageUrl)}
              alt={productName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              onError={(e) => {
                console.warn(`[ProductCard] Failed to load image: ${displayImageUrl}`);
                setImageError(true);
              }}
              onLoad={() => {
                // Reset error state if image loads successfully
                if (imageError) setImageError(false);
              }}
              unoptimized={
                displayImageUrl?.includes("amazon.com") ||
                displayImageUrl?.includes("media-amazon.com") ||
                displayImageUrl?.includes("tiktok.com")
              }
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-sm">
                {displayImageUrl && !isValidImageUrl(displayImageUrl) 
                  ? "Invalid Image URL" 
                  : "No Image"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Product Details Section */}
      <div className="px-5 pt-4 pb-4 sm:p-4 space-y-3">
        {/* Product Title */}
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
          {productName}
        </h3>

        {/* Sales and Commission Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-green-600">
              {formatSales(sales7d)} Sales
            </span>
            <span className="text-xs text-gray-400">(7 days)</span>
            <TrendingUp className="w-3 h-3 text-green-600" />
          </div>
          <span className="text-sm font-semibold text-blue-600">
            {commission} Commission
          </span>
        </div>

        {/* Video Thumbnails Section - ALWAYS VISIBLE */}
        {/* Client requirement: "Each product shows up to 3 TikTok thumbnails" */}
        <div className="w-full">
          <div className="flex gap-2 w-full">
            {videoThumbnails && videoThumbnails.length > 0 ? (
              videoThumbnails
              .slice(0, 3)
                .map((item, displayIndex) => {
              // Normalize to get URL
              const videoUrl = typeof item === 'string' ? item : item.url;
              // For TikTok videos, completely ignore stored thumbnails (they're expired)
              // Only use them for non-TikTok videos
              const storedThumbnail = typeof item === 'string' ? null : item.thumbnailUrl;
              
              // Use the original index in the array for state tracking
              const originalIndex = videoThumbnails.findIndex(v => 
                (typeof v === 'string' ? v : v.url) === videoUrl
              );
              const hasError = thumbnailErrors[originalIndex];
              const isTikTokVideo = videoUrl?.includes("tiktok.com");
              const tiktokThumbnail = tiktokThumbnails[originalIndex];
              const isValidImage = isValidImageUrl(videoUrl) && !hasError;
              
              // Determine what to show
              let imageSrc: string | null = null;
              const fetchComplete = tiktokFetchComplete[originalIndex];
              
              // Store the original video URL for retry logic
              const originalVideoUrl = typeof videoUrl === 'string' ? videoUrl : videoUrl;
              
              if (isTikTokVideo) {
                // For TikTok videos, ONLY use fetched thumbnails (fresh from oEmbed API)
                // NEVER use stored thumbnails - they're expired TikTok CDN URLs (403 errors)
                // Fresh thumbnails from oEmbed API are valid - use DIRECTLY (no proxy) for best performance
                // This matches the TikTok detail page behavior
                const thumbnail = tiktokThumbnail; // Only use fetched, completely ignore stored
                if (thumbnail && isValidImageUrl(thumbnail)) {
                  // Make sure thumbnail URL is a real image URL, not a video URL
                  if (!thumbnail.includes('/video/') && !thumbnail.includes('#thumbnail')) {
                    // Use fresh thumbnails DIRECTLY - same as TikTok detail page
                    // No proxy needed - fresh thumbnails are valid and perform better when used directly
                    imageSrc = thumbnail;
                  } else {
                    console.warn(`[ProductCard] Invalid thumbnail URL (video URL detected): ${thumbnail}`);
                    imageSrc = null;
                  }
                } else {
                  imageSrc = null;
                }
              } else if (isValidImage) {
                // For non-TikTok videos, use direct image URL (no proxy needed)
                imageSrc = getSafeImageUrl(videoUrl);
              }

              // Show loading only if it's a TikTok video, fetch isn't complete, and we don't have a thumbnail yet
              const shouldShowLoading = isTikTokVideo && !fetchComplete && !tiktokThumbnail && !hasError;
              
              // For TikTok videos: show placeholder if fetch is complete but no thumbnail
              const shouldShowPlaceholder = isTikTokVideo && fetchComplete && !tiktokThumbnail && !hasError;

              // Extract TikTok video ID for routing
              const tiktokVideoId = isTikTokVideo ? extractTikTokVideoId(videoUrl) : null;
              const videoLink = tiktokVideoId ? `/tiktok/${tiktokVideoId}` : null;

              // Create the thumbnail container
              const thumbnailContent = (
                <div
                  className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-200 flex-1 group cursor-pointer min-w-[80px]"
                  title={videoUrl || 'Video thumbnail'}
                >
                  {/* Show thumbnail image if available */}
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={`Video ${displayIndex + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 33vw, 100px"
                      onError={(e) => {
                        console.warn(`[ProductCard] Failed to load thumbnail for video ${displayIndex + 1}:`, imageSrc);
                        
                        // Mark as error immediately
                        setThumbnailErrors((prev) => ({
                          ...prev,
                          [originalIndex]: true,
                        }));
                        
                        // For TikTok videos, if thumbnail fails to load, try fetching fresh thumbnail ONCE
                        // Limit retries to prevent excessive API calls
                        if (isTikTokVideo && originalVideoUrl) {
                          const videoUrlString = typeof originalVideoUrl === 'string' ? originalVideoUrl : originalVideoUrl;
                          
                          // Check retry attempts - only retry ONCE per video URL
                          const retryCount = retryAttemptsRef.current.get(videoUrlString) || 0;
                          const maxRetries = 1; // Only retry once to prevent excessive API calls
                          
                          // Only retry if:
                          // 1. We haven't exceeded max retries
                          // 2. This URL hasn't been marked as permanently failed
                          // 3. We haven't already retried for this specific video/index combination
                          if (retryCount < maxRetries && !failedFetchesRef.current.has(videoUrlString)) {
                            // Increment retry counter
                            retryAttemptsRef.current.set(videoUrlString, retryCount + 1);
                            
                            console.log(`[ProductCard] Thumbnail failed, fetching fresh thumbnail (attempt ${retryCount + 1}/${maxRetries + 1})...`);
                            
                            // Fetch fresh thumbnail via API
                            fetch(`/api/tiktok/thumbnail?url=${encodeURIComponent(videoUrlString)}`, {
                              signal: AbortSignal.timeout(10000),
                            })
                              .then((response) => {
                                if (!response.ok) {
                                  throw new Error(`HTTP ${response.status}`);
                                }
                                return response.json();
                              })
                              .then((data) => {
                                if (data.thumbnailUrl) {
                                  console.log(`[ProductCard] ✅ Successfully fetched fresh thumbnail on retry`);
                                  // Update with fresh thumbnail - use DIRECTLY (no proxy) for best performance
                                  setTiktokThumbnails((prev) => ({
                                    ...prev,
                                    [originalIndex]: data.thumbnailUrl, // Direct URL, no proxy
                                  }));
                                  // Clear error state since we got a fresh thumbnail
                                  setThumbnailErrors((prev) => {
                                    const updated = { ...prev };
                                    delete updated[originalIndex];
                                    return updated;
                                  });
                                  // Mark as complete
                                  setTiktokFetchComplete((prev) => ({
                                    ...prev,
                                    [originalIndex]: true,
                                  }));
                                } else {
                                  // No thumbnail available - mark as permanently failed
                                  failedFetchesRef.current.add(videoUrlString);
                                  // Store in sessionStorage to persist across page reloads
                                  try {
                                    const stored = Array.from(failedFetchesRef.current);
                                    sessionStorage.setItem('tiktok_failed_thumbnails', JSON.stringify(stored));
                                  } catch (e) {
                                    // Ignore sessionStorage errors
                                  }
                                  setTiktokFetchComplete((prev) => ({
                                    ...prev,
                                    [originalIndex]: true,
                                  }));
                                }
                              })
                              .catch((err) => {
                                // Failed to fetch - mark as permanently failed to prevent more retries
                                failedFetchesRef.current.add(videoUrlString);
                                // Store in sessionStorage to persist across page reloads
                                try {
                                  const stored = Array.from(failedFetchesRef.current);
                                  sessionStorage.setItem('tiktok_failed_thumbnails', JSON.stringify(stored));
                                } catch (e) {
                                  // Ignore sessionStorage errors
                                }
                                setTiktokFetchComplete((prev) => ({
                                  ...prev,
                                  [originalIndex]: true,
                                }));
                                // Silently handle - no need to log expected failures
                              });
                          } else {
                            // Max retries exceeded or already marked as failed - mark as complete
                            if (retryCount >= maxRetries) {
                              failedFetchesRef.current.add(videoUrlString); // Mark as permanently failed
                              // Store in sessionStorage to persist across page reloads
                              try {
                                const stored = Array.from(failedFetchesRef.current);
                                sessionStorage.setItem('tiktok_failed_thumbnails', JSON.stringify(stored));
                              } catch (e) {
                                // Ignore sessionStorage errors
                              }
                            }
                            setTiktokFetchComplete((prev) => ({
                              ...prev,
                              [originalIndex]: true,
                            }));
                          }
                        } else {
                          // Not a TikTok video, mark as complete
                          setTiktokFetchComplete((prev) => ({
                            ...prev,
                            [originalIndex]: true,
                          }));
                        }
                      }}
                      onLoad={() => {
                        console.log(`[ProductCard] Successfully loaded thumbnail for video ${displayIndex + 1}`);
                      }}
                      unoptimized={true} // TikTok thumbnails need to be unoptimized
                    />
                  ) : (
                    /* Show loading or placeholder while fetching or if no thumbnail */
                    <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                      <div className="text-center">
                        {shouldShowLoading ? (
                          <Loader size="md" text="Loading..." className="text-white" />
                        ) : (
                          <>
                            <Play className="w-10 h-10 text-white fill-white mx-auto mb-1" />
                            <span className="text-xs text-white/80 font-medium">
                              {isTikTokVideo ? "TikTok" : "Video"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Video Number Badge */}
                  <div className="absolute top-1 right-1 bg-black/70 text-white text-xs rounded px-1.5 py-0.5 font-semibold z-10">
                    {displayIndex + 1}
                  </div>
                  {/* Play Icon Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-black/60 rounded-full p-3">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                </div>
              );

              // Wrap in Link if it's a TikTok video, otherwise just return the div
              if (videoLink) {
                return (
                  <Link key={`${originalIndex}-${videoUrl}`} href={videoLink}>
                    {thumbnailContent}
                  </Link>
                );
              }

              return (
                <div key={`${originalIndex}-${videoUrl}`}>
                  {thumbnailContent}
                </div>
              );
                })
            ) : (
              // Show placeholder when no videos are available - ensure it's always visible
              <div className="w-full flex gap-2">
                {[1, 2, 3].map((num) => (
                  <div 
                    key={num}
                    className="flex-1 aspect-square rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 min-h-[80px]"
                  >
                    <div className="text-center">
                      <Play className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">No video</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons Section */}
      {/* Removed Remix button per v1 requirements - users should click video thumbnails instead */}
      <div className="px-5 pb-5 pt-0 sm:p-4 sm:pt-0">
        {/* Amazon Video Button */}
        <button
          onClick={() => {
            if (amazonUrl) {
              window.open(amazonUrl, '_blank');
            }
          }}
          disabled={!amazonUrl}
          className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 transition-colors ${
            amazonUrl
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 cursor-pointer'
              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
        >
          <i className="fab fa-amazon text-[#FF9900]"></i>
          <span className="text-sm font-medium">View on Amazon</span>
        </button>
      </div>
    </div>
  );
}
