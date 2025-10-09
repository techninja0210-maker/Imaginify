const { PrismaClient } = require('@prisma/client');

async function keepAlive() {
  const prisma = new PrismaClient();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`[${new Date().toISOString()}] ✅ Database keep-alive successful`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Database keep-alive failed:`, error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run keep-alive every 4 minutes (240 seconds)
const interval = 4 * 60 * 1000; // 4 minutes in milliseconds

console.log('🔄 Starting database keep-alive service...');
console.log(`⏰ Will ping database every ${interval / 1000} seconds`);
console.log('🛑 Press Ctrl+C to stop');

// Initial ping
keepAlive();

// Set up interval
const intervalId = setInterval(keepAlive, interval);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping keep-alive service...');
  clearInterval(intervalId);
  process.exit(0);
});
