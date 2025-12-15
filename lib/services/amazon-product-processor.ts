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
  const productImages = json?.product?.images;
  
  // Get main image from first valid image in arrays
  // Note: The backfill actor puts the main image URL as the first item in the images array
  // There is NO primary_image_url field in the backfill actor schema
  const getFirstValidImage = (images: any[]): string | null => {
    if (!Array.isArray(images) || images.length === 0) return null;
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    for (const img of images) {
      const imgUrl = typeof img === 'string' ? img : img?.url || img?.src || null;
      if (!imgUrl || typeof imgUrl !== 'string') continue;
      
      // Skip video thumbnails/icons (like .png play button overlays)
      const isVideoThumbnail = imgUrl.includes('play-icon') || 
                               imgUrl.includes('overlay') ||
                               imgUrl.includes('default.jobtemplate');
      if (isVideoThumbnail) continue;
      
      // Only consider actual image files
      const hasImageExtension = imageExtensions.some(ext => 
        imgUrl.toLowerCase().includes(ext)
      );
      if (!hasImageExtension && !imgUrl.includes('media-amazon.com/images/I/')) continue;
      
      // If it's a small thumbnail (e.g., _AC_US100_), upscale it to higher resolution
      if (imgUrl.match(/_AC_[SLXYU]\d+_/)) {
        return imgUrl.replace(/_AC_[SLXYU]\d+_/g, '_AC_SL1500_');
      }
      
      return imgUrl;
    }
    
    return null;
  };
  
  // Try product.images first, then media.images
  let mainImageUrl: string | null = null;
  if (Array.isArray(productImages) && productImages.length > 0) {
    mainImageUrl = getFirstValidImage(productImages);
  }
  
  if (!mainImageUrl && Array.isArray(media?.images) && media.images.length > 0) {
    mainImageUrl = getFirstValidImage(media.images);
  }

  // Merge images from both sources, prioritizing media.images, then product.images
  let allImages: any[] = [];
  if (Array.isArray(media?.images) && media.images.length > 0) {
    allImages = media.images;
  } else if (Array.isArray(productImages) && productImages.length > 0) {
    allImages = productImages;
  } else {
    allImages = [];
  }

  return { mainImageUrl, allImages: allImages.length > 0 ? allImages : null };
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
  // Check both json.scraped_at and meta.scraped_at
  const scrapedAt = json.scraped_at 
    ? new Date(json.scraped_at) 
    : (meta.scraped_at ? new Date(meta.scraped_at) : null);

  // Extract images
  const { mainImageUrl, allImages } = extractImages(json);

  // Extract price information
  const price = product.price || {};
  const salePrice = price.current ? parseFloat(String(price.current)) : null;
  const listPrice = price.list ? parseFloat(String(price.list)) : null;
  const currency = price.currency || null;

  // Extract ratings - handle both 'average' and 'value' field names
  const rating = product.social_proof?.rating || {};
  const averageRating = rating.average 
    ? parseFloat(String(rating.average)) 
    : (rating.value ? parseFloat(String(rating.value)) : null);
  const ratingScale = rating.scale ? parseFloat(String(rating.scale)) : null;
  const totalRatings = rating.count ? parseInt(String(rating.count), 10) : null;

  // Extract badges
  const badges = product.badges || {};

  // Extract availability
  const availability = product.availability || {};

  // Check both engagement.units_sold and sales.units_sold
  const engagementUnitsSold = product.engagement?.units_sold || {};
  const salesUnitsSold = product.sales?.units_sold || {};
  const unitsSold = engagementUnitsSold.display ? engagementUnitsSold : salesUnitsSold;
  
  const unitsSoldDisplay = unitsSold.display || null;
  const unitsSoldNumericEstimate = unitsSold.numeric_estimate
    ? parseInt(String(unitsSold.numeric_estimate), 10)
    : null;
  
  // Extract engagement metrics - check both engagement and sales
  const salesUsuallyKept = product.sales?.usually_kept || {};
  const customersUsuallyKeep = product.engagement?.customers_usually_keep || salesUsuallyKept || {};
  
  const customersUsuallyKeepPercentage = customersUsuallyKeep.percentage
    ? parseFloat(String(customersUsuallyKeep.percentage))
    : null;
  const customersUsuallyKeepRaw = customersUsuallyKeep.raw || null;

  // Extract URL and locale/marketplace - check both product.url and source.product_url
  const productUrl = product.url || source.product_url || null;
  const locale = json.locale || source.locale || null;
  const marketplace = json.marketplace || source.marketplace || null;

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

  // Process reviews from social_proof.reviews_by_star
  await processReviews(json, asin);

  return { success: true, asin, created, updated };
}

/**
 * Process reviews from social_proof.reviews_by_star and save to AmazonProductReview table
 */
async function processReviews(json: AmazonProductJson, asin: string): Promise<void> {
  const reviewsByStar = json?.product?.social_proof?.reviews_by_star;
  if (!reviewsByStar || typeof reviewsByStar !== 'object') {
    return; // No reviews to process
  }

  // Collect all reviews from all star ratings
  const allReviews: any[] = [];
  Object.keys(reviewsByStar).forEach((starRating) => {
    const reviews = reviewsByStar[starRating];
    if (Array.isArray(reviews)) {
      reviews.forEach((review: any) => {
        if (review && typeof review === 'object') {
          allReviews.push({
            ...review,
            starRating: parseInt(starRating, 10),
          });
        }
      });
    }
  });

  if (allReviews.length === 0) {
    return; // No valid reviews
  }

  // Process each review
  for (const review of allReviews) {
    try {
      // Extract rating value from "X.0 out of 5 stars" format or use starRating
      let ratingValue = review.starRating || null;
      if (review.rating && typeof review.rating === 'string') {
        const match = review.rating.match(/(\d+\.?\d*)/);
        if (match) {
          ratingValue = parseFloat(match[1]);
        }
      }

      // Skip if no valid rating
      if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
        continue;
      }

      const starRatingInt = Math.round(ratingValue);
      const reviewer = review.reviewer || null;
      const title = review.title || null;
      const date = review.date || null;

      // Check if review already exists (by asin, reviewer, title, and date)
      // Since we don't have a unique constraint, we'll check manually
      const existingReview = await prisma.amazonProductReview.findFirst({
        where: {
          asin,
          reviewer: reviewer || undefined,
          title: title || undefined,
          date: date || undefined,
        },
      });

      if (existingReview) {
        // Update existing review
        await prisma.amazonProductReview.update({
          where: { id: existingReview.id },
          data: {
            rating: ratingValue,
            starRating: starRatingInt,
            body: review.body || null,
            verified: review.verified || null,
          },
        });
      } else {
        // Create new review
        await prisma.amazonProductReview.create({
          data: {
            asin,
            rating: ratingValue,
            starRating: starRatingInt,
            reviewer,
            title,
            body: review.body || null,
            date,
            verified: review.verified || null,
          },
        });
      }
    } catch (error) {
      // Log error but continue processing other reviews
      console.error(`[AMAZON_PROCESSOR] Error processing review for ASIN ${asin}:`, error);
    }
  }
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

  // Check both json.scraped_at and meta.scraped_at
  const scrapedAt = json.scraped_at 
    ? new Date(json.scraped_at) 
    : (json.meta?.scraped_at ? new Date(json.meta.scraped_at) : new Date());

  // Update only image fields
  await prisma.amazonProduct.update({
    where: { asin },
    data: {
      mainImageUrl,
      allImages: allImages ? (Array.isArray(allImages) ? JSON.parse(JSON.stringify(allImages)) : null) : null,
      // Update scrapedAt to reflect when images were updated
      scrapedAt,
    },
  });

  return {
    success: true,
    asin,
    updated: true,
    productExists: true,
  };
}

