import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTikTokDisplayImages() {
  try {
    console.log('Checking TikTok product display images in database...\n');

    // Get all trending products
    const products = await prisma.trendingProduct.findMany({
      select: {
        id: true,
        tiktokProductId: true,
        name: true,
        displayImageUrl: true,
        tiktokProductUrl: true,
      },
      take: 20, // Check first 20 products
    });

    console.log(`Total products found: ${products.length}\n`);

    // Count products by image source
    let withTikTokImages = 0;
    let withAmazonImages = 0;
    let withPlaceholders = 0;
    let withOtherImages = 0;
    let withNoImages = 0;

    const tiktokImageUrls: string[] = [];
    const amazonImageUrls: string[] = [];

    products.forEach((product) => {
      const imageUrl = product.displayImageUrl;

      if (!imageUrl || imageUrl.trim() === '') {
        withNoImages++;
      } else if (imageUrl.includes('tiktokcdn')) {
        // TikTok CDN image URLs (actual image URLs, not video URLs)
        withTikTokImages++;
        tiktokImageUrls.push(imageUrl);
      } else if (imageUrl.includes('amazon.com') || imageUrl.includes('media-amazon.com')) {
        withAmazonImages++;
        amazonImageUrls.push(imageUrl);
      } else if (imageUrl.includes('product-placeholder.png')) {
        withPlaceholders++;
      } else if (imageUrl.includes('tiktok.com') && imageUrl.includes('/video/')) {
        // This is a video URL, not an image URL - count as "other" or "no image"
        withOtherImages++;
      } else {
        withOtherImages++;
      }
    });

    console.log('=== Summary ===');
    console.log(`Products with TikTok images: ${withTikTokImages}`);
    console.log(`Products with Amazon images: ${withAmazonImages}`);
    console.log(`Products with placeholders: ${withPlaceholders}`);
    console.log(`Products with other images: ${withOtherImages}`);
    console.log(`Products with no images: ${withNoImages}`);
    console.log('');

    if (withTikTokImages > 0) {
      console.log(`\n=== Sample TikTok Image URLs (showing first 5) ===`);
      tiktokImageUrls.slice(0, 5).forEach((url, index) => {
        console.log(`${index + 1}. ${url.substring(0, 100)}...`);
      });
      console.log(`\n✅ CONFIRMED: There ARE TikTok product display image URLs in the database!`);
      console.log(`   Total: ${withTikTokImages} products have TikTok image URLs stored.`);
    } else {
      console.log('\n❌ No TikTok image URLs found in database.');
    }

    if (withAmazonImages > 0) {
      console.log(`\n=== Sample Amazon Image URLs (showing first 3) ===`);
      amazonImageUrls.slice(0, 3).forEach((url, index) => {
        console.log(`${index + 1}. ${url.substring(0, 100)}...`);
      });
    }

    // Show a few sample products
    console.log(`\n=== Sample Products (showing all) ===`);
    products.forEach((product, index) => {
      const imageUrl = product.displayImageUrl || '';
      const productUrl = product.tiktokProductUrl || '';
      
      let imageType = 'Other';
      if (imageUrl.includes('tiktokcdn')) {
        imageType = 'TikTok CDN Image';
      } else if (imageUrl.includes('amazon.com') || imageUrl.includes('media-amazon.com')) {
        imageType = 'Amazon';
      } else if (imageUrl.includes('placeholder')) {
        imageType = 'Placeholder';
      } else if (imageUrl.includes('tiktok.com') && imageUrl.includes('/video/')) {
        imageType = 'TikTok Video URL (NOT an image!)';
      }
      
      let productUrlType = 'Unknown';
      if (productUrl.includes('/product/')) {
        productUrlType = '✅ TikTok Product URL';
      } else if (productUrl.includes('/video/')) {
        productUrlType = '❌ TikTok Video URL (Wrong!)';
      } else if (productUrl.includes('shop.tiktok.com')) {
        productUrlType = '✅ TikTok Shop Product URL';
      }
      
      console.log(`\n${index + 1}. ${product.name.substring(0, 60)}...`);
      console.log(`   Product ID: ${product.tiktokProductId}`);
      console.log(`   Product URL: ${productUrlType}`);
      console.log(`   Product URL: ${productUrl.substring(0, 100)}${productUrl.length > 100 ? '...' : ''}`);
      console.log(`   Display Image: ${imageType}`);
      console.log(`   Display Image URL: ${imageUrl.substring(0, 100)}${imageUrl.length > 100 ? '...' : ''}`);
    });

  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTikTokDisplayImages();

