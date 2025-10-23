const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupAdmin() {
  try {
    console.log('🔧 Setting up admin user...');
    
    // Find the first user and make them a SUPER_ADMIN
    const firstUser = await prisma.user.findFirst({
      orderBy: { createdAt: 'asc' }
    });
    
    if (!firstUser) {
      console.log('❌ No users found. Please create a user first.');
      return;
    }
    
    // Update the first user to be a SUPER_ADMIN
    const updatedUser = await prisma.user.update({
      where: { id: firstUser.id },
      data: { 
        role: 'SUPER_ADMIN',
        isActive: true
      }
    });
    
    console.log('✅ Admin setup complete!');
    console.log(`👤 User: ${updatedUser.firstName || updatedUser.username || updatedUser.email}`);
    console.log(`🔑 Role: ${updatedUser.role}`);
    console.log(`📧 Email: ${updatedUser.email}`);
    console.log(`🆔 Clerk ID: ${updatedUser.clerkId}`);
    console.log('\n🚀 This user can now access the admin console at /admin');
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupAdmin();



