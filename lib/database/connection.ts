import { PrismaClient } from '@prisma/client';

// Global Prisma instance with connection management
let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with connection management
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

// Use global instance in development to prevent connection leaks
if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  prisma = global.__prisma;
}

// Database health check with retry logic
export async function checkDatabaseHealth(maxRetries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log(`✅ Database connection successful (attempt ${attempt})`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Database connection failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt === maxRetries) {
        console.error('❌ Database connection failed after all retries');
        return false;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

// Warm up database connection
export async function warmupDatabase(): Promise<void> {
  try {
    await checkDatabaseHealth();
    console.log('🔥 Database warmed up successfully');
  } catch (error) {
    console.error('❌ Database warmup failed:', error);
  }
}

export { prisma };
