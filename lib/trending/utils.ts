/**
 * Utility functions for trending product import system
 */

/**
 * Extracts TikTok Product ID from URL
 * Example: /product/1234567890123456789 → 1234567890123456789
 */
export function extractTikTokProductId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Match /product/{digits} pattern
  const match = trimmed.match(/\/product\/(\d+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Extracts Amazon ASIN from URL
 * Only processes .com domains, extracts 10-character ASIN
 * Example: https://www.amazon.com/dp/B0ABCDE123 → B0ABCDE123
 */
export function extractAmazonAsin(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Only process .com domains
  if (!trimmed.includes("amazon.com")) return null;

  // Match ASIN patterns: /dp/{ASIN} or /gp/product/{ASIN} or ?asin={ASIN}
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Normalizes Amazon URL to canonical format
 * https://www.amazon.com/dp/{ASIN}
 */
export function normalizeAmazonUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}`;
}

/**
 * Parses a number from string, handling commas, symbols, and nulls
 */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  // Remove commas, spaces, and common symbols
  const cleaned = value.trim().replace(/[,\s$€£¥]/g, "");
  if (!cleaned) return null;

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parses price to integer cents
 * Strips symbols and commas, converts to cents
 */
export function parsePriceToCents(value: unknown): number | null {
  const num = parseNumber(value);
  if (num === null) return null;
  // Assume input is in dollars, convert to cents
  return Math.round(num * 100);
}

/**
 * Calculates name overlap ratio between TikTok and Amazon product names
 * Returns a value between 0 and 1, or null if either name is missing
 */
export function nameOverlapRatio(tiktokName?: string, amazonTitle?: string | null): number | null {
  if (!tiktokName || !amazonTitle) return null;

  const tiktokWords = new Set(
    tiktokName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const amazonWords = new Set(
    amazonTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (tiktokWords.size === 0 || amazonWords.size === 0) return null;

  let matches = 0;
  for (const word of Array.from(tiktokWords)) {
    if (amazonWords.has(word)) {
      matches += 1;
    }
  }

  return matches / Math.max(tiktokWords.size, amazonWords.size);
}

/**
 * Calculates price gap ratio
 * Returns a value between 0 and 1, or null if either price is missing
 */
export function priceGapRatio(tiktokPriceCents?: number | null, amazonPriceCents?: number | null): number | null {
  if (tiktokPriceCents === null || tiktokPriceCents === undefined) return null;
  if (amazonPriceCents === null || amazonPriceCents === undefined) return null;
  if (tiktokPriceCents === 0 || amazonPriceCents === 0) return null;

  const gap = Math.abs(tiktokPriceCents - amazonPriceCents);
  const avg = (tiktokPriceCents + amazonPriceCents) / 2;
  return gap / avg;
}

/**
 * Selects display image with priority: Amazon > TikTok > Placeholder
 */
export function selectDisplayImage({
  currentUrl,
  amazonImageUrl,
  tiktokThumbnailUrl,
}: {
  currentUrl?: string | null;
  amazonImageUrl?: string;
  tiktokThumbnailUrl?: string;
}): { url: string; source: "amazon" | "tiktok" | "placeholder" } {
  // Keep existing if it's already set and valid
  if (currentUrl && currentUrl !== "/img/product-placeholder.png") {
    return { url: currentUrl, source: currentUrl.includes("amazon") ? "amazon" : "tiktok" };
  }

  // Priority: Amazon > TikTok > Placeholder
  if (amazonImageUrl && amazonImageUrl.trim()) {
    return { url: amazonImageUrl.trim(), source: "amazon" };
  }

  if (tiktokThumbnailUrl && tiktokThumbnailUrl.trim()) {
    return { url: tiktokThumbnailUrl.trim(), source: "tiktok" };
  }

  return { url: "/img/product-placeholder.png", source: "placeholder" };
}

/**
 * Converts Date to ISO date string (YYYY-MM-DD)
 */
export function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

