/**
 * Helper function to fetch TikTok thumbnail URL
 * Used during import to store thumbnails in the database
 */

export async function fetchTikTokThumbnail(videoUrl: string): Promise<string | null> {
  if (!videoUrl || !videoUrl.includes("tiktok.com")) {
    return null;
  }

  try {
    const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;

    const response = await fetch(oEmbedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.tiktok.com/",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return data.thumbnail_url || null;
    }

    // TikTok API often blocks requests - return null gracefully
    return null;
  } catch (error) {
    // Silently handle errors - TikTok blocking is expected
    return null;
  }
}

