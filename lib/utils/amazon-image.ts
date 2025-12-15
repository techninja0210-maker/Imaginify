/**
 * Amazon Image URL Utilities
 * Helper functions to get high-resolution Amazon product images
 */

/**
 * Amazon image URLs typically have size parameters like:
 * - _AC_SL1500_ (500px, 1000px, 1500px, 2000px, etc.)
 * - _AC_SX679_ (fixed width)
 * - _AC_UL640_ (640px)
 * - _AC_SY679_ (679px)
 * 
 * Higher resolution sizes: _AC_SL2000_, _AC_SL2500_, etc.
 */

/**
 * Get high-resolution version of an Amazon image URL
 * Tries multiple strategies to get the best quality image
 */
export function getHighResAmazonImageUrl(
  imageUrl: string | null | undefined,
  allImages?: any[] | null
): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  // Not an Amazon image URL
  if (!imageUrl.includes('amazon.com') && !imageUrl.includes('media-amazon.com')) {
    return imageUrl;
  }

  // Strategy 1: Look for higher resolution in allImages array
  if (allImages && Array.isArray(allImages) && allImages.length > 0) {
    // Find the largest image from allImages
    let largestImage: string | null = null;
    let maxSize = 0;

    for (const img of allImages) {
      const imgUrl = typeof img === 'string' ? img : img?.url || img?.src || null;
      if (!imgUrl || typeof imgUrl !== 'string') continue;

      // Extract size from URL (look for _AC_SL{size}_ pattern)
      const sizeMatch = imgUrl.match(/_AC_SL(\d+)_/);
      if (sizeMatch) {
        const size = parseInt(sizeMatch[1], 10);
        if (size > maxSize) {
          maxSize = size;
          largestImage = imgUrl;
        }
      } else {
        // If no size parameter, prefer this one (might be original/high-res)
        if (!largestImage) {
          largestImage = imgUrl;
        }
      }
    }

    if (largestImage && maxSize >= 1500) {
      return largestImage;
    }
  }

  // Strategy 2: Modify URL to get higher resolution version
  // Try common high-resolution sizes in order of preference
  const highResSizes = ['2000', '2500', '3000', '1500', '1000'];
  
  for (const size of highResSizes) {
    // Replace _AC_SL{any_number}_ with _AC_SL{size}_
    const highResUrl = imageUrl.replace(/_AC_SL\d+_/g, `_AC_SL${size}_`);
    
    // If URL changed, return the high-res version
    if (highResUrl !== imageUrl) {
      return highResUrl;
    }
  }

  // Strategy 3: If no size parameter exists, try adding one
  // This handles URLs without explicit size parameters
  if (!imageUrl.match(/_AC_S[LX]\d+_/)) {
    // Try adding _AC_SL2000_ before the file extension
    const extensionMatch = imageUrl.match(/(\.(jpg|jpeg|png|webp))(\?|$)/i);
    if (extensionMatch) {
      const beforeExt = imageUrl.substring(0, extensionMatch.index);
      const afterExt = imageUrl.substring(extensionMatch.index || imageUrl.length);
      return `${beforeExt}._AC_SL2000_${afterExt}`;
    }
  }

  // Fallback: return original URL
  return imageUrl;
}

/**
 * Extract available sizes from an Amazon image URL
 */
export function getAmazonImageSizes(imageUrl: string): number[] {
  const sizes: number[] = [];
  const matches = imageUrl.matchAll(/_AC_SL(\d+)_/g);
  
  for (const match of matches) {
    const size = parseInt(match[1], 10);
    if (!sizes.includes(size)) {
      sizes.push(size);
    }
  }
  
  return sizes.sort((a, b) => b - a); // Descending order
}

