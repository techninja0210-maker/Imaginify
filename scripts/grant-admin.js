/**
 * Grant Admin Access Script
 * 
 * Usage: node scripts/grant-admin.js <email>
 * Example: node scripts/grant-admin.js your-email@gmail.com
 * 
 * This script grants ADMIN role to a user by email
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function grantAdmin(email) {
  try {
    if (!email) {
      console.error('❌ Error: Email is required');
      console.log('Usage: node scripts/grant-admin.js <email>');
      process.exit(1);
    }

    console.log(`🔍 Looking for user with email: ${email}...`);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        clerkId: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    console.log(`\n📋 Current User Info:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Clerk ID: ${user.clerkId}`);
    console.log(`   Current Role: ${user.role}`);
    console.log(`   Name: ${user.firstName || 'N/A'} ${user.lastName || ''}`);

    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      console.log(`\n✅ User already has admin access (${user.role})`);
      process.exit(0);
    }

    console.log(`\n🔄 Updating role to ADMIN...`);

    const updated = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
      select: {
        email: true,
        role: true,
      },
    });

    console.log(`\n✅ Success! User role updated:`);
    console.log(`   Email: ${updated.email}`);
    console.log(`   New Role: ${updated.role}`);
    console.log(`\n🎉 You can now access /admin page!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('   Duplicate entry - user might already exist');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line arguments
const email = process.argv[2];

grantAdmin(email);

