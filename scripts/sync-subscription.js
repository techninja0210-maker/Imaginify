/**
 * Script to sync subscription for a user
 * 
 * Usage: node scripts/sync-subscription.js <email>
 * Example: node scripts/sync-subscription.js techninja0210@gmail.com
 */

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/sync-subscription.js <email>');
  console.error('Example: node scripts/sync-subscription.js techninja0210@gmail.com');
  process.exit(1);
}

async function syncSubscription() {
  // Determine the base URL
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/admin/sync-subscription`;

  console.log(`\n🔄 Syncing subscription for: ${email}`);
  console.log(`📡 Calling: ${url}\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      // Include cookies for authentication (if running locally)
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', data.error || data.message || 'Unknown error');
      if (data.details) {
        console.error('Details:', data.details);
      }
      process.exit(1);
    }

    console.log('✅ Success!');
    console.log('\n📊 Results:');
    console.log(JSON.stringify(data, null, 2));

    if (data.summary) {
      console.log(`\n📈 Summary:`);
      console.log(`   Total: ${data.summary.total}`);
      console.log(`   Success: ${data.summary.success}`);
      console.log(`   Skipped: ${data.summary.skipped}`);
      console.log(`   Errors: ${data.summary.errors}`);
    }

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      if (result.status === 'success') {
        console.log(`\n🎉 Subscription synced successfully!`);
        console.log(`   Plan: ${result.planName}`);
        console.log(`   Credits: ${result.creditsPerCycle}`);
        console.log(`   Credits Granted: ${result.creditsGranted ? 'Yes' : 'No'}`);
        console.log(`   Status: ${result.subscriptionStatus}`);
        console.log(`   Period End: ${result.periodEnd}`);
      } else if (result.status === 'error') {
        console.error(`\n❌ Error: ${result.error}`);
        process.exit(1);
      }
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Your development server is running');
    console.error('   2. You are logged in as an admin user');
    console.error('   3. The NEXT_PUBLIC_SERVER_URL is set correctly');
    process.exit(1);
  }
}

syncSubscription();

