import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { PriceBookEntryForm } from "@/components/admin/PriceBookEntryForm";
import Link from "next/link";
import { ArrowLeft, Plus, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

async function getAllPriceBookEntries() {
  return prisma.priceBookEntry.findMany({
    orderBy: [
      { pipelineKey: "asc" },
    ],
  });
}

const PriceBookPage = async () => {
  const currentUser = await requireAdmin();
  const entries = await getAllPriceBookEntries();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin?tab=price-book"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Back to Admin Console"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 font-medium">Admin Console</span>
                  <span className="text-xs text-gray-400">/</span>
                  <span className="text-xs text-purple-600 font-medium">Price Book</span>
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Price Book Management</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage credit costs for pipeline types
                </p>
              </div>
            </div>
            <Link
              href="/admin/price-book/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Entry
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Active Entries</p>
                <p className="text-2xl font-bold text-gray-900">
                  {entries.filter((e) => e.active).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Price Book Entries */}
        {entries.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No price book entries</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first entry.</p>
            <Link
              href="/admin/price-book/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Entry
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                  >
                    <PriceBookEntryForm entry={entry} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceBookPage;
