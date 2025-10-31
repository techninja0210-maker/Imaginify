import { auth } from "@clerk/nextjs";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Collection } from "@/components/shared/Collection";
import { prisma } from "@/lib/database/prisma";
import { getUserJobs } from "@/lib/actions/job.actions";
import { getUserById } from "@/lib/actions/user.actions";
import Link from "next/link";

const Profile = async ({ searchParams }: SearchParamProps) => {
  const page = Number(searchParams?.page) || 1;
  const { userId } = auth();

  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  if (!user) redirect("/sign-in");

  const jobs = await getUserJobs({ page, userId: user.id });

  const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;
  const ledger = orgId 
    ? await prisma.creditLedger.findMany({ 
        where: { organizationId: orgId }, 
        orderBy: { createdAt: 'desc' }, 
        take: 10 
      }) 
    : [];

  const userBalance = user.creditBalance || 0;
  const orgBalance = user.organizationMembers?.[0]?.organization?.credits?.balance || 0;
  const isOutOfSync = userBalance !== orgBalance;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your account and view your activity
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Top Section - Credits & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Credits Available Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Credits Available
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg">
                  <span className="text-3xl">💰</span>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Current Balance</p>
                  <p className="text-4xl font-bold text-gray-900">{userBalance.toLocaleString()}</p>
                </div>
              </div>

              {/* Balance Details */}
              <div className="space-y-3 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">User Balance</span>
                  <span className="text-sm font-semibold text-gray-900">{userBalance.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Org Balance</span>
                  <span className="text-sm font-semibold text-gray-900">{orgBalance.toLocaleString()}</span>
                </div>
                {isOutOfSync && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800 font-medium flex items-center gap-2">
                      <span>⚠️</span>
                      <span>Balances are out of sync</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                <Link
                  href="/credits"
                  className="block w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors text-center shadow-sm"
                >
                  Buy More Credits
                </Link>
                <Link
                  href="/billing"
                  className="block w-full px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors text-center"
                >
                  Manage Subscription
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Credit Activity Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Recent Credit Activity
                </h2>
                <Link
                  href="/profile/activity"
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  View All
                </Link>
              </div>
            </div>
            <div className="p-6">
              {ledger.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No recent activity</p>
                  <p className="text-xs text-gray-400 mt-1">Your credit transactions will appear here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {ledger.map((entry: any) => {
                    const isPositive = entry.amount >= 0;
                    const date = new Date(entry.createdAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    });
                    const time = new Date(entry.createdAt).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <div className={`w-2 h-2 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {entry.type === 'allocation' ? 'Credit Added' : 'Credit Deducted'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 truncate ml-5">
                            {entry.reason}
                          </p>
                          <p className="text-xs text-gray-400 mt-1 ml-5">
                            {date} at {time}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span
                            className={`text-lg font-bold ${
                              isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {isPositive ? '+' : ''}{entry.amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Edits Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Recent Edits</h2>
                <p className="text-sm text-gray-500 mt-1">Your latest transformations</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {jobs?.data && jobs.data.length > 0 ? (
              <Collection
                images={jobs.data}
                totalPages={jobs.totalPages}
                page={page}
              />
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No edits yet</h3>
                <p className="text-sm text-gray-500 mb-6">Start transforming your images to see them here</p>
                <Link
                  href="/transformations/add/restore"
                  className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
