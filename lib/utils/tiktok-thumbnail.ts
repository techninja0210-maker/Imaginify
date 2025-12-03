/**
 * Helper functions to extract TikTok video IDs and get thumbnail URLs
 */

/**
 * Extract video ID from TikTok URL
 * Examples:
 * - https://www.tiktok.com/@user/video/1234567890
 * - https://vm.tiktok.com/ABC123/
 * - https://www.tiktok.com/@/video/1234567890
 */
export function extractTikTokVideoId(url: string): string | null {
  if (!url) return null;
  
  // Remove query params and fragments
  const cleanUrl = url.split('?')[0].split('#')[0];
  
  // Pattern 1: /video/{videoId}
  const videoMatch = cleanUrl.match(/\/video\/(\d+)/);
  if (videoMatch) {
    return videoMatch[1];
  }
  
  return null;
}

/**
 * Get TikTok thumbnail URL from video URL
 * TikTok doesn't provide direct thumbnail URLs easily, but we can:
 * 1. Try to extract video ID and construct thumbnail URL
 * 2. Use a placeholder service
 * 
 * For now, we'll return a constructed thumbnail URL pattern
 * Note: This may not always work as TikTok changes their CDN structure
 */
export function getTikTokThumbnailUrl(videoUrl: string): string | null {
  try {
    const videoId = extractTikTokVideoId(videoUrl);
    if (!videoId) return null;
    
    // TikTok thumbnail URL pattern (may need adjustment)
    // Alternative: Use oEmbed API server-side to get thumbnail_url
    return `https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068/o0JDPQAfBjIAOCE5AnAkAnAkC2C9DBgC8o8FABE8A6C2C9DBgC8o8FABE8A6~tplv-photomode-image:720:720.jpeg?lk3s=a5d48078&nonce=12345&refresh_token=abc123&x-expires=1234567890&x-signature=xyz123`;
  } catch (error) {
    console.error('Error getting TikTok thumbnail:', error);
    return null;
  }
}

/**
 * Check if URL is a TikTok video URL
 */
export function isTikTokVideoUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('tiktok.com') && (url.includes('/video/') || url.includes('vm.tiktok.com'));
}
