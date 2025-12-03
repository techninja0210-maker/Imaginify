const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearTrendingProducts() {
  try {
    console.log('🗑️  Starting cleanup of trending products data...\n');

    // Step 1: Delete User Favorite Products (references TrendingProduct)
    console.log('1️⃣  Deleting user favorite products...');
    const deletedFavorites = await prisma.userFavoriteProduct.deleteMany({});
    console.log(`   ✅ Deleted ${deletedFavorites.count} favorite products\n`);

    // Step 2: Delete Trending Videos (references TrendingProduct)
    console.log('2️⃣  Deleting trending videos...');
    const deletedVideos = await prisma.trendingVideo.deleteMany({});
    console.log(`   ✅ Deleted ${deletedVideos.count} videos\n`);

    // Step 3: Delete Product Amazon Matches (references TrendingProduct and AmazonProduct)
    console.log('3️⃣  Deleting product Amazon matches...');
    const deletedMatches = await prisma.productAmazonMatch.deleteMany({});
    console.log(`   ✅ Deleted ${deletedMatches.count} Amazon matches\n`);

    // Step 4: Delete Product Week Stats (references TrendingProduct and WeeklyReport)
    console.log('4️⃣  Deleting product week stats...');
    const deletedStats = await prisma.productWeekStat.deleteMany({});
    console.log(`   ✅ Deleted ${deletedStats.count} week stats\n`);

    // Step 5: Delete Trending Products
    console.log('5️⃣  Deleting trending products...');
    const deletedProducts = await prisma.trendingProduct.deleteMany({});
    console.log(`   ✅ Deleted ${deletedProducts.count} products\n`);

    // Step 6: Delete Trending Import Logs (references WeeklyReport and User)
    console.log('6️⃣  Deleting import logs...');
    const deletedLogs = await prisma.trendingImportLog.deleteMany({});
    console.log(`   ✅ Deleted ${deletedLogs.count} import logs\n`);

    // Step 7: Delete Weekly Reports (contains stats and import logs)
    console.log('7️⃣  Deleting weekly reports...');
    const deletedReports = await prisma.weeklyReport.deleteMany({});
    console.log(`   ✅ Deleted ${deletedReports.count} weekly reports\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Cleanup completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Summary:');
    console.log(`   • Favorites: ${deletedFavorites.count}`);
    console.log(`   • Videos: ${deletedVideos.count}`);
    console.log(`   • Amazon Matches: ${deletedMatches.count}`);
    console.log(`   • Week Stats: ${deletedStats.count}`);
    console.log(`   • Products: ${deletedProducts.count}`);
    console.log(`   • Import Logs: ${deletedLogs.count}`);
    console.log(`   • Weekly Reports: ${deletedReports.count}`);
    console.log('\n💡 Note: Amazon products were NOT deleted.');
    console.log('   You can now re-import trending products from the admin panel.\n');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    console.error('\n⚠️  If you see foreign key constraint errors,');
    console.error('   the script may need to be run in a different order.');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
clearTrendingProducts()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

