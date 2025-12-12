"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Bell, ExternalLink, Play, TrendingUp, DollarSign, ShoppingCart, ArrowLeft, Package, BarChart3, Users, Eye, MousePointerClick, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TikTokVideoData {
  tiktok_id: string;
  tiktok_url: string;
  thumbnail_url?: string | null;
  product: {
    title: string;
    image_url: string;
    category?: string;
  };
  creator: {
    handle: string;
    avatar_url?: string;
  };
  metrics: {
    gmv?: number | null;
    units_sold?: number | null;
    orders?: number | null;
    views?: number | null;
    clicks?: number | null;
    ctr?: number | null;
    conversion_rate?: number | null;
  };
  price: {
    current: number | null;
    currency: string;
    original?: number | null;
    discount_percent?: number | null;
  };
  amazon_match: {
    has_match: boolean;
    asin?: string;
    amazon_url?: string;
  };
}

export default function TikTokDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const tiktokId = params?.tiktokId as string;

  const [isMounted, setIsMounted] = useState(false);
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<TikTokVideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);

  // Hide sidebar and other layout elements immediately
  useEffect(() => {
    const hideLayoutElements = () => {
      const sidebar = document.querySelector("aside.sidebar");
      const mobileNav = document.querySelector("header.header");
      const footer = document.querySelector("footer");
      const lowBalanceBanner = document.querySelector('[class*="LowBalanceBanner"]');
      const wrapper = document.querySelector(".root-container .wrapper");

      if (sidebar instanceof HTMLElement) {
        sidebar.style.cssText = "display: none !important;";
      }
      if (mobileNav instanceof HTMLElement) {
        mobileNav.style.cssText = "display: none !important;";
      }
      if (footer instanceof HTMLElement) {
        footer.style.cssText = "display: none !important;";
      }
      if (lowBalanceBanner instanceof HTMLElement) {
        lowBalanceBanner.style.cssText = "display: none !important;";
      }
      if (wrapper instanceof HTMLElement) {
        wrapper.style.cssText = "display: none !important;";
      }

      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    };

    // Hide immediately
    hideLayoutElements();
    
    // Also hide after a short delay to catch any late-rendering elements
    const timeout1 = setTimeout(hideLayoutElements, 0);
    const timeout2 = setTimeout(hideLayoutElements, 100);
    const timeout3 = setTimeout(hideLayoutElements, 300);

    // Set up portal
    setIsMounted(true);
    const portalContainer = document.createElement("div");
    portalContainer.setAttribute("data-tiktok-detail-portal", "true");
    document.body.appendChild(portalContainer);
    setPortalElement(portalContainer);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
      
      const sidebar = document.querySelector("aside.sidebar");
      const mobileNav = document.querySelector("header.header");
      const footer = document.querySelector("footer");
      const wrapper = document.querySelector(".root-container .wrapper");
      const lowBalanceBanner = document.querySelector('[class*="LowBalanceBanner"]');

      if (sidebar instanceof HTMLElement) sidebar.style.cssText = "";
      if (mobileNav instanceof HTMLElement) mobileNav.style.cssText = "";
      if (footer instanceof HTMLElement) footer.style.cssText = "";
      if (wrapper instanceof HTMLElement) wrapper.style.cssText = "";
      if (lowBalanceBanner instanceof HTMLElement) lowBalanceBanner.style.cssText = "";

      const portal = document.querySelector("[data-tiktok-detail-portal]");
      if (portal && portal.parentNode) {
        portal.parentNode.removeChild(portal);
      }

      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  // Fetch video data
  useEffect(() => {
    if (!tiktokId) {
      setError("Invalid video ID");
      setLoading(false);
      return;
    }

    async function fetchVideoData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/tiktok/${tiktokId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Video not found in trending products");
          }
          throw new Error(`Failed to load video: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          setData(result);
          // Always fetch fresh thumbnail for TikTok videos
          // Stored thumbnails from database are often expired TikTok CDN URLs (403 errors)
          // This matches the behavior of the trending page
          setThumbnailLoading(true);
          setThumbnailError(false);
        } else {
          throw new Error(result.error || "Failed to load video data");
        }
      } catch (err: any) {
        console.error("Error fetching video data:", err);
        setError(err.message || "Failed to load video");
      } finally {
        setLoading(false);
      }
    }

    fetchVideoData();
  }, [tiktokId]);

  // Always fetch fresh thumbnail for TikTok videos
  // Ignore stored thumbnails from database - they're often expired TikTok CDN URLs (403 errors)
  useEffect(() => {
    if (!data || !data.tiktok_url) return;

    // Store tiktok_url in a variable to avoid TypeScript issues
    const tiktokUrl = data.tiktok_url;

    // Always fetch fresh thumbnail via oEmbed API (matches trending page behavior)
    async function fetchThumbnail() {
      try {
        setThumbnailLoading(true);
        setThumbnailError(false);
        
        const response = await fetch(`/api/tiktok/thumbnail?url=${encodeURIComponent(tiktokUrl)}`);
        if (response.ok) {
          const result = await response.json();
          if (result.thumbnailUrl) {
            // Update data with fresh thumbnail (direct URL, no proxy - same as trending page)
            setData((prev) => prev ? { ...prev, thumbnail_url: result.thumbnailUrl } : null);
            setThumbnailError(false);
          } else {
            // No thumbnail available
            setThumbnailError(true);
          }
        } else {
          // API request failed
          setThumbnailError(true);
        }
      } catch (err) {
        console.warn('[TikTok Detail] Failed to fetch thumbnail:', err);
        setThumbnailError(true);
      } finally {
        setThumbnailLoading(false);
      }
    }

    fetchThumbnail();
    // Only re-fetch if tiktok_url changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.tiktok_url]);

  // Handle redirect to Makoto's processor
  const handleStartRemixWorkflow = () => {
    if (!data) return;

    const tiktokProcessorUrl = 
      (typeof window !== 'undefined' && (window as any).__TIKTOK_PROCESSOR_URL__) ||
      process.env.NEXT_PUBLIC_TIKTOK_PROCESSOR_URL || 
      "https://tiktok-processor.example.com";
    
    const encodedUrl = encodeURIComponent(data.tiktok_url);
    const redirectUrl = `${tiktokProcessorUrl}/?tiktokId=${data.tiktok_id}&tiktokUrl=${encodedUrl}`;

    window.location.href = redirectUrl;
  };

  // Format number with commas
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "N/A";
    return num.toLocaleString();
  };

  // Format percentage
  const formatPercent = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return "N/A";
    return `${(num * 100).toFixed(2)}%`;
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined, currency: string = "USD"): string => {
    if (amount === null || amount === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const pageContent = (
    <div
      data-tiktok-detail-page="true"
      className="fixed inset-0 flex flex-col bg-gray-50 overflow-auto w-screen h-screen z-[99999]"
    >
      <div className="flex-1 overflow-auto">
        {/* Modern Header */}
        <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => {
                    // Save current time to detect if we're navigating back to trending
                    sessionStorage.setItem('trending_return_timestamp', Date.now().toString())
                    router.back()
                  }}
                  variant="ghost"
                  size="sm"
                  className="p-2 hover:bg-gray-100"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Button>
                <Link href="/trending" className="flex items-center">
                  <Image
                    src="/img/logo.png"
                    alt="Shoppable Videos"
                    width={140}
                    height={32}
                    className="hidden md:block"
                    priority
                  />
                  <Image
                    src="/img/logo-responsive.png"
                    alt="Shoppable Videos"
                    width={100}
                    height={32}
                    className="block md:hidden"
                    priority
                  />
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <Bell className="w-5 h-5 text-gray-600" />
                </button>
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading video details...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-md bg-white rounded-xl p-8 shadow-sm border border-gray-200">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <Button onClick={() => router.push("/trending")} variant="outline">
                  Back to Trending Products
                </Button>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Hero Section - Video Preview & Primary CTA */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                  {/* Left: Video Preview */}
                  <div className="flex flex-col items-center lg:items-start">
                    <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg border-4 border-gray-900">
                      {data.thumbnail_url && !thumbnailError && !thumbnailLoading ? (
                        <Image
                          src={data.thumbnail_url}
                          alt="TikTok Video Preview"
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 400px"
                          onError={() => {
                            console.warn('[TikTok Detail] Failed to load thumbnail:', data.thumbnail_url);
                            setThumbnailError(true);
                          }}
                          onLoad={() => {
                            setThumbnailLoading(false);
                            setThumbnailError(false);
                          }}
                          unoptimized={true}
                        />
                      ) : thumbnailLoading ? (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                          <div className="text-center">
                            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
                            <p className="text-white/80 text-sm">Loading preview...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
                          <Play className="w-20 h-20 text-white/80" />
                        </div>
                      )}
                      
                      {/* Play Button Overlay */}
                      <div 
                        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors cursor-pointer"
                        onClick={() => window.open(data.tiktok_url, "_blank")}
                      >
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30 hover:bg-white/30 transition-colors">
                          <Play className="w-10 h-10 text-white fill-white ml-1" />
                        </div>
                      </div>

                      {/* TikTok Badge */}
                      <div className="absolute top-3 right-3">
                        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                          <i className="fab fa-tiktok text-white text-sm"></i>
                          <span className="text-white text-xs font-medium">TikTok</span>
                        </div>
                      </div>
                    </div>

                    {/* Open in TikTok Button */}
                    <Button
                      onClick={() => window.open(data.tiktok_url, "_blank")}
                      variant="outline"
                      className="mt-4 w-full max-w-sm border-gray-300 hover:bg-gray-50"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in TikTok
                    </Button>
                  </div>

                  {/* Right: Product Info & Primary CTA */}
                  <div className="flex flex-col justify-between">
                    {/* Product Info */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight flex-1">
                            {data.product.title}
                          </h1>
                          {/* Amazon Match Badge */}
                          {data.amazon_match.has_match && (
                            <div className="flex-shrink-0">
                              <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                                <i className="fab fa-amazon text-orange-600 text-lg"></i>
                                <span className="text-xs font-semibold text-orange-700">Amazon Match</span>
                                {data.amazon_match.asin && (
                                  <span className="text-xs font-mono text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                                    {data.amazon_match.asin}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          {data.creator.handle && (
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4" />
                              {data.creator.handle}
                            </span>
                          )}
                          {data.product.category && (
                            <>
                              {data.creator.handle && <span>•</span>}
                              <span>{data.product.category}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Product Image */}
                      <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100">
                        <Image
                          src={data.product.image_url}
                          alt={data.product.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 192px, 224px"
                          onError={(e) => {
                            console.warn('[TikTok Detail] Failed to load product image:', data.product.image_url);
                            // Fallback to placeholder
                            const target = e.target as HTMLImageElement;
                            if (target) {
                              target.src = "/img/product-placeholder.png";
                            }
                          }}
                          unoptimized={data.product.image_url.includes('amazon') || data.product.image_url.includes('tiktok')}
                        />
                      </div>

                      {/* Price Display */}
                      {data.price.current !== null && (
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-bold text-gray-900">
                            {formatCurrency(data.price.current, data.price.currency)}
                          </span>
                          {data.price.original && (
                            <span className="text-lg text-gray-500 line-through">
                              {formatCurrency(data.price.original, data.price.currency)}
                            </span>
                          )}
                          {data.price.discount_percent && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded">
                              {data.price.discount_percent}% OFF
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Primary CTA */}
                    <div className="mt-6 space-y-3">
                      <Button
                        onClick={handleStartRemixWorkflow}
                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-base font-semibold shadow-lg shadow-blue-500/30 transition-all"
                        size="lg"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Start Remix Workflow
                      </Button>

                      {/* Amazon Match Badge */}
                      {data.amazon_match.has_match && data.amazon_match.amazon_url && (
                        <Button
                          onClick={() => window.open(data.amazon_match.amazon_url, "_blank")}
                          variant="outline"
                          className="w-full border-orange-300 hover:bg-orange-50 text-orange-700"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          View on Amazon
                          {data.amazon_match.asin && (
                            <span className="ml-2 text-xs font-mono bg-orange-100 px-2 py-0.5 rounded">
                              {data.amazon_match.asin}
                            </span>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                    Performance Metrics
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Metric
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                              <Package className="w-4 h-4 text-green-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">Units Sold (7d)</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatNumber(data.metrics.units_sold)}</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <DollarSign className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">GMV</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(data.metrics.gmv, data.price.currency)}</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <Eye className="w-4 h-4 text-purple-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">Views</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatNumber(data.metrics.views)}</span>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 rounded-lg">
                              <Target className="w-4 h-4 text-orange-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">Conversion Rate</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-gray-900">{formatPercent(data.metrics.conversion_rate)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Additional Metrics */}
              {(data.metrics.orders || data.metrics.clicks || data.metrics.ctr) && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                    Additional Metrics
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {data.metrics.orders !== null && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Orders</p>
                        <p className="text-xl font-semibold text-gray-900">{formatNumber(data.metrics.orders)}</p>
                      </div>
                    )}
                    {data.metrics.clicks !== null && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                          <MousePointerClick className="w-3 h-3" />
                          Clicks
                        </p>
                        <p className="text-xl font-semibold text-gray-900">{formatNumber(data.metrics.clicks)}</p>
                      </div>
                    )}
                    {data.metrics.ctr !== null && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">CTR</p>
                        <p className="text-xl font-semibold text-gray-900">{formatPercent(data.metrics.ctr)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // Hide sidebar immediately on initial render
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const hideElements = () => {
      const sidebar = document.querySelector("aside.sidebar");
      const mobileNav = document.querySelector("header.header");
      const footer = document.querySelector("footer");
      const lowBalanceBanner = document.querySelector('[class*="LowBalanceBanner"]');
      const wrapper = document.querySelector(".root-container .wrapper");

      if (sidebar instanceof HTMLElement) {
        sidebar.style.cssText = "display: none !important;";
      }
      if (mobileNav instanceof HTMLElement) {
        mobileNav.style.cssText = "display: none !important;";
      }
      if (footer instanceof HTMLElement) {
        footer.style.cssText = "display: none !important;";
      }
      if (lowBalanceBanner instanceof HTMLElement) {
        lowBalanceBanner.style.cssText = "display: none !important;";
      }
      if (wrapper instanceof HTMLElement) {
        wrapper.style.cssText = "display: none !important;";
      }
    };

    // Hide immediately
    hideElements();
  }, []);

  if (!isMounted || !portalElement) {
    // Return a full-screen loading state to prevent root layout from showing
    return (
      <div 
        className="fixed inset-0 flex flex-col bg-gray-50 overflow-auto w-screen h-screen z-[99999]"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading video details...</p>
          </div>
        </div>
      </div>
    );
  }

  return createPortal(pageContent, portalElement);
}