import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/actions/user.actions";
import { prisma } from "@/lib/database/prisma";
import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 20;

const ActivityPage = async ({ searchParams }: { searchParams: { page?: string } }) => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  if (!user) redirect("/sign-in");

  const currentPage = Number(searchParams?.page) || 1;
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <p className="text-gray-500">No organization found</p>
          </div>
        </div>
      </div>
    );
  }

  const [ledger, total] = await Promise.all([
    prisma.creditLedger.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: ITEMS_PER_PAGE,
      skip,
    }),
    prisma.creditLedger.count({
      where: { organizationId: orgId },
    }),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/profile"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Credit Activity</h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Complete transaction history
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{total.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {ledger.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No activity yet</h3>
              <p className="text-sm text-gray-500 mb-6">Your credit transactions will appear here</p>
              <Link
                href="/credits"
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
              >
                Buy Credits
              </Link>
            </div>
          ) : (
            <>
              {/* Activity List */}
              <div className="divide-y divide-gray-200">
                {ledger.map((entry: any) => {
                  const isPositive = entry.amount >= 0;
                  const date = new Date(entry.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const time = new Date(entry.createdAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                            isPositive ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-base font-semibold text-gray-900">
                              {entry.type === 'allocation' ? 'Credit Added' : entry.type === 'deduction' ? 'Credit Deducted' : 'Credit Refunded'}
                            </p>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                entry.type === 'allocation'
                                  ? 'bg-green-100 text-green-700'
                                  : entry.type === 'deduction'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {entry.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{entry.reason}</p>
                          <p className="text-xs text-gray-400">
                            {date} at {time}
                          </p>
                        </div>
                      </div>
                      <div className="ml-6 flex-shrink-0">
                        <span
                          className={`text-xl font-bold ${
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <Pagination>
                    <PaginationContent className="flex items-center justify-between w-full">
                      <div className="text-sm text-gray-600">
                        Showing {skip + 1} to {Math.min(skip + ITEMS_PER_PAGE, total)} of {total} transactions
                      </div>
                      <div className="flex items-center gap-2">
                        {currentPage > 1 && (
                          <PaginationPrevious
                            href={`/profile/activity?page=${currentPage - 1}`}
                          />
                        )}
                        <span className="text-sm text-gray-600 px-4">
                          Page {currentPage} of {totalPages}
                        </span>
                        {currentPage < totalPages && (
                          <PaginationNext
                            href={`/profile/activity?page=${currentPage + 1}`}
                          />
                        )}
                      </div>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;

