import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/database/prisma';

/**
 * Page to sync credit balance
 * Visit: /admin/sync-balance?email=techninja0210@gmail.com
 */
export default async function SyncBalancePage({ searchParams }: { searchParams: { email?: string } }) {
  const { userId } = auth();
  if (!userId) redirect('/sign-in');

  const email = searchParams.email || 'techninja0210@gmail.com';

  try {
    // Get user with org info
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organizationMembers: {
          include: {
            organization: {
              include: {
                credits: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-4">Sync Credit Balance</h1>
          <p className="text-red-600">User not found: {email}</p>
        </div>
      );
    }

    const orgId = user.organizationMembers?.[0]?.organization?.id;
    const orgCredits = user.organizationMembers?.[0]?.organization?.credits;

    if (!orgId || !orgCredits) {
        
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-4">Sync Credit Balance</h1>
          <p className="text-red-600">User organization not found</p>
        </div>
      );
    }

    const userBalanceBefore = user.creditBalance;
    const orgBalance = orgCredits.balance;
    const difference = orgBalance - userBalanceBefore;

    // Sync if there's a difference
    let synced = false;
    let result = null;

    if (difference !== 0) {
      result = await prisma.$transaction(async (tx) => {
        // Update user balance to match org balance
        const updatedUser = await tx.user.update({
          where: { clerkId: user.clerkId },
          data: { creditBalance: orgBalance }
        });

        // Create a ledger entry to record the sync
        await tx.creditLedger.create({
          data: {
            organizationId: orgId,
            userId: user.id,
            type: 'allocation',
            amount: difference,
            reason: `Balance sync: Org balance (${orgBalance}) - User balance (${userBalanceBefore})`,
            idempotencyKey: `sync:${Date.now()}:${user.clerkId}`
          }
        });

        return updatedUser;
      });
      synced = true;
    }

    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Credit Balance Sync</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="font-semibold mb-2">User: {user.email}</h2>
            <p className="text-sm text-gray-600">Clerk ID: {user.clerkId}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">User Balance (Before)</p>
              <p className="text-2xl font-bold">{userBalanceBefore}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Org Balance</p>
              <p className="text-2xl font-bold">{orgBalance}</p>
            </div>
          </div>

          {difference !== 0 ? (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="font-semibold text-yellow-800">Difference: {difference > 0 ? '+' : ''}{difference} credits</p>
              </div>

              {synced ? (
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  <p className="font-semibold text-green-800">✅ Synced Successfully!</p>
                  <p className="text-sm text-green-700 mt-2">
                    User balance updated to: {result?.creditBalance || orgBalance}
                  </p>
                </div>
              ) : (
                <p className="text-gray-600">Refresh page to sync...</p>
              )}
            </>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="font-semibold text-green-800">✅ Balances are already in sync!</p>
            </div>
          )}

          <div className="mt-6">
            <a 
              href="/admin/sync-balance?email=techninja0210@gmail.com" 
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh & Sync Again
            </a>
            <a 
              href="/api/admin/check-balance?email=techninja0210@gmail.com" 
              className="inline-block ml-4 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              target="_blank"
            >
              Check Balance API
            </a>
          </div>
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Sync Credit Balance</h1>
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-800 font-semibold">Error:</p>
          <p className="text-red-600">{error?.message || 'Unknown error'}</p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
              {error.stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

