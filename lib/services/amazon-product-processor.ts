import { prisma } from "@/lib/database/prisma";

/**
 * Amazon Product JSON Processor
 * Transforms raw JSON from Apify Actor schema v1.1 into normalized AmazonProduct database records
 */

type AmazonProductJson = any; // JSON structure from Apify Actor schema v1.1

interface ProcessFullProductResult {
  success: boolean;
  asin: string;
  created: boolean;
  updated: boolean;
}

interface ProcessImagesOnlyResult {
  success: boolean;
  asin: string;
  updated: boolean;
  productExists: boolean;
}

/**
 * Extract and transform images from JSON structure
 */
function extractImages(json: AmazonProductJson): {
  mainImageUrl: string | null;
  allImages: any[] | null;
} {
  const media = json?.product?.media;
  if (!media) {
    return { mainImageUrl: null, allImages: null };
  }

  const mainImageUrl = media.primary_image_url || null;
  const allImages = media.images || null;

  return { mainImageUrl, allImages };
}

/**
 * Process full product JSON and upsert into AmazonProduct table
 */
export async function processFullProduct(json: AmazonProductJson): Promise<ProcessFullProductResult> {
  const asin = json?.product?.asin;
  if (!asin) {
    throw new Error("Missing required field: product.asin");
  }

  const product = json.product;
  const source = json.source || {};
  const meta = json.meta || {};
  const scrapedAt = json.scraped_at ? new Date(json.scraped_at) : null;

  // Extract images
  const { mainImageUrl, allImages } = extractImages(json);

  // Extract price information
  const price = product.price || {};
  const salePrice = price.current ? parseFloat(String(price.current)) : null;
  const listPrice = price.list ? parseFloat(String(price.list)) : null;
  const currency = price.currency || null;

  // Extract ratings
  const rating = product.social_proof?.rating || {};
  const averageRating = rating.value ? parseFloat(String(rating.value)) : null;
  const ratingScale = rating.scale ? parseFloat(String(rating.scale)) : null;
  const totalRatings = rating.count ? parseInt(String(rating.count), 10) : null;

  // Extract badges
  const badges = product.badges || {};

  // Extract availability
  const availability = product.availability || {};

  // Extract engagement metrics
  const customersUsuallyKeep = product.engagement?.customers_usually_keep || {};
  const customersUsuallyKeepPercentage = customersUsuallyKeep.percentage
    ? parseFloat(String(customersUsuallyKeep.percentage))
    : null;
  const customersUsuallyKeepRaw = customersUsuallyKeep.raw || null;

  const unitsSold = product.engagement?.units_sold || {};
  const unitsSoldDisplay = unitsSold.display || null;
  const unitsSoldNumericEstimate = unitsSold.numeric_estimate
    ? parseInt(String(unitsSold.numeric_estimate), 10)
    : null;

  // Extract URL and locale/marketplace
  const productUrl = product.url || null;
  const locale = json.locale || null;
  const marketplace = json.marketplace || null;

  // Extract copy/text fields
  const copy = product.copy || {};
  const descriptionText = copy.long_description_text || null;
  const shortDescription = copy.short_description || null;
  const longDescriptionHtml = copy.long_description_html || null;
  const bullets = copy.bullet_points || null;

  // Extract categories
  const categoryPath = product.categories || null;

  // Extract related products
  const relatedProducts = {
    similar_items: product.related_products?.similar_items || [],
    related_asins: product.related_products?.related_asins || [],
  };

  // Extract videos
  const videos = product.media?.videos || null;

  // Prepare upsert data
  const upsertData = {
    asin,
    locale,
    marketplace,
    productUrl,
    canonicalUrl: productUrl, // Keep for backward compatibility
    version: meta.scraper_version || null,
    source: "amazon",
    scrapedAt,
    title: product.title || null,
    brand: product.brand || null,
    categoryPath: categoryPath ? (Array.isArray(categoryPath) ? JSON.parse(JSON.stringify(categoryPath)) : null) : null,
    descriptionText,
    shortDescription,
    longDescriptionHtml,
    bullets: bullets ? (Array.isArray(bullets) ? JSON.parse(JSON.stringify(bullets)) : null) : null,
    mainImageUrl,
    allImages: allImages ? (Array.isArray(allImages) ? JSON.parse(JSON.stringify(allImages)) : null) : null,
    videos: videos ? (Array.isArray(videos) ? JSON.parse(JSON.stringify(videos)) : null) : null,
    salePrice,
    listPrice,
    currency,
    priceDisplay: price.display || null,
    availabilityStatus: availability.status || null,
    availabilityText: availability.text || null,
    customersUsuallyKeepPercentage,
    customersUsuallyKeepRaw,
    unitsSoldDisplay,
    unitsSoldNumericEstimate,
    averageRating,
    ratingScale,
    totalRatings,
    isPrime: badges.is_prime || false,
    isBestSeller: badges.is_best_seller || false,
    isAmazonChoice: badges.is_amazon_choice || false,
    hasCoupon: badges.has_coupon || false,
    hasLimitedTimeDeal: badges.has_limited_time_deal || false,
    sourceType: source.type || null,
    sourceActor: source.actor || null,
    sourceSubmittedBy: source.submitted_by || null,
    sourceIngestMethod: source.ingest_method || null,
    sourceTimestamp: source.timestamp ? new Date(source.timestamp) : null,
    rawHtmlIncluded: meta.raw_html_included || false,
    metaNotes: meta.notes || null,
    relatedProducts: relatedProducts ? JSON.parse(JSON.stringify(relatedProducts)) : null,
  };

  // Check if product already exists
  const existing = await prisma.amazonProduct.findUnique({
    where: { asin },
  });

  let created = false;
  let updated = false;

  if (existing) {
    // Update existing product
    await prisma.amazonProduct.update({
      where: { asin },
      data: upsertData,
    });
    updated = true;
  } else {
    // Create new product
    await prisma.amazonProduct.create({
      data: upsertData,
    });
    created = true;
  }

  return { success: true, asin, created, updated };
}

/**
 * Process images-only JSON and update existing product
 */
export async function processImagesOnly(json: AmazonProductJson): Promise<ProcessImagesOnlyResult> {
  const asin = json?.product?.asin;
  if (!asin) {
    throw new Error("Missing required field: product.asin");
  }

  // Check if product exists
  const existing = await prisma.amazonProduct.findUnique({
    where: { asin },
  });

  if (!existing) {
    return {
      success: false,
      asin,
      updated: false,
      productExists: false,
    };
  }

  // Extract images
  const { mainImageUrl, allImages } = extractImages(json);

  // Update only image fields
  await prisma.amazonProduct.update({
    where: { asin },
    data: {
      mainImageUrl,
      allImages: allImages ? (Array.isArray(allImages) ? JSON.parse(JSON.stringify(allImages)) : null) : null,
      // Update scrapedAt to reflect when images were updated
      scrapedAt: json.scraped_at ? new Date(json.scraped_at) : new Date(),
    },
  });

  return {
    success: true,
    asin,
    updated: true,
    productExists: true,
  };
}

