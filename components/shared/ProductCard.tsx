"use client";

import Image from "next/image";
import { Heart, TrendingUp, Play } from "lucide-react";
import { useState, useEffect, useRef } from "react";

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
}

// Helper function to check if URL is a valid image URL
function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  if (url.startsWith("/")) return true; // Local path
  if (url.includes("tiktok.com")) return false; // TikTok URLs are videos, not images
  if (url.includes("amazon.com")) return true; // Amazon URLs might be images
  // Check for common image extensions
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  return imageExtensions.some((ext) => url.toLowerCase().includes(ext));
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
  const fetchedRef = useRef<Set<string>>(new Set());

  const handleFavoriteClick = () => {
    setIsFav(!isFav);
    onFavoriteToggle?.();
  };

  // Format sales number with commas
  const formatSales = (sales: number) => {
    return sales.toLocaleString();
  };

  // Get safe image URL - use placeholder if invalid
  const getSafeImageUrl = (
    url: string | undefined | null,
    fallback: string = "/img/product-placeholder.png"
  ) => {
    if (!url || !isValidImageUrl(url)) return fallback;
    return url;
  };

  // Process video thumbnails - use stored thumbnails first, fetch if needed
  useEffect(() => {
    if (videoThumbnails.length === 0) return;

    const processThumbnails = async () => {
      // Normalize videoThumbnails to array of objects with url and optional thumbnailUrl
      const normalizedVideos = videoThumbnails.map((item) => {
        if (typeof item === 'string') {
          return { url: item, thumbnailUrl: null };
        }
        return item;
      });

      // First, set stored thumbnails (if available)
      normalizedVideos.forEach((video, index) => {
        if (video.thumbnailUrl) {
          setTiktokThumbnails((prev) => ({
            ...prev,
            [index]: video.thumbnailUrl!,
          }));
          setTiktokFetchComplete((prev) => ({
            ...prev,
            [index]: true,
          }));
        }
      });

      // Then fetch missing thumbnails for TikTok videos
      const promises = normalizedVideos.map(async (video, index) => {
        const videoUrl = video.url;
        const storedThumbnail = video.thumbnailUrl;

        // Skip if we already have a stored thumbnail or if it's not a TikTok URL
        if (storedThumbnail || !videoUrl?.includes("tiktok.com")) {
          if (!storedThumbnail && !videoUrl?.includes("tiktok.com")) {
            // Mark non-TikTok videos as complete
            setTiktokFetchComplete((prev) => ({
              ...prev,
              [index]: true,
            }));
          }
          return;
        }

        // Only fetch if we haven't already fetched it
        if (fetchedRef.current.has(videoUrl)) {
          return;
        }

        fetchedRef.current.add(videoUrl); // Mark as fetching

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
            // No thumbnail available - set to null explicitly to stop loading
            // This will show a placeholder instead
            setTiktokThumbnails((prev) => ({
              ...prev,
              [index]: null,
            }));
          }
        } catch (error) {
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
              onError={() => setImageError(true)}
              unoptimized={
                displayImageUrl?.includes("amazon.com") ||
                displayImageUrl?.includes("tiktok.com")
              }
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-sm">No Image</span>
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

        {/* Video Thumbnails Section */}
        {videoThumbnails.length > 0 && (
          <div className="flex gap-2">
            {videoThumbnails
              .slice(0, 3)
              .map((item, displayIndex) => {
              // Normalize to get URL
              const videoUrl = typeof item === 'string' ? item : item.url;
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
              // Priority: stored thumbnail > fetched thumbnail > direct image URL
              let imageSrc: string | null = null;
              const fetchComplete = tiktokFetchComplete[originalIndex];
              
              if (isTikTokVideo) {
                // For TikTok videos, use stored thumbnail first, then fetched
                imageSrc = storedThumbnail || tiktokThumbnail || null;
              } else if (isValidImage) {
                imageSrc = getSafeImageUrl(videoUrl); // Use direct image URL for non-TikTok videos
              }

              // Show loading only if it's a TikTok video, fetch isn't complete, and we don't have a thumbnail yet
              const shouldShowLoading = isTikTokVideo && !fetchComplete && !tiktokThumbnail && !hasError;
              
              // For TikTok videos: show placeholder if fetch is complete but no thumbnail
              const shouldShowPlaceholder = isTikTokVideo && fetchComplete && !tiktokThumbnail && !hasError;

              return (
                <div
                  key={`${originalIndex}-${videoUrl}`}
                  className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-200 flex-1 group cursor-pointer"
                  title={videoUrl}
                >
                  {/* Show thumbnail image if available */}
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt={`Video ${displayIndex + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 33vw, 100px"
                      onError={() => {
                        setThumbnailErrors((prev) => ({
                          ...prev,
                          [originalIndex]: true,
                        }));
                        // Clear TikTok thumbnail on error
                        if (isTikTokVideo) {
                          setTiktokThumbnails((prev) => ({
                            ...prev,
                            [originalIndex]: null,
                          }));
                          setTiktokFetchComplete((prev) => ({
                            ...prev,
                            [originalIndex]: true,
                          }));
                        }
                      }}
                      unoptimized={true} // TikTok thumbnails need to be unoptimized
                    />
                  ) : (
                    /* Show loading or placeholder while fetching or if no thumbnail */
                    <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                      <div className="text-center">
                        {shouldShowLoading ? (
                          <>
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <span className="text-xs text-white/80 font-medium">Loading...</span>
                          </>
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
            })}
          </div>
        )}
      </div>

      {/* Action Buttons Section */}
      <div className="px-5 pb-5 pt-0 sm:p-4 sm:pt-0 flex flex-col sm:flex-row gap-2">
        {/* TikTok Remix Button */}
        <button className="w-full sm:flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors">
          <i className="fab fa-tiktok text-white"></i>
          <span className="text-sm font-medium">Remix</span>
        </button>

        {/* Amazon Video Button */}
        <button className="w-full sm:flex-1 h-10 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg flex items-center justify-center gap-2 transition-colors">
          <i className="fab fa-amazon text-[#FF9900]"></i>
          <span className="text-sm font-medium">Video</span>
        </button>
      </div>
    </div>
  );
}
