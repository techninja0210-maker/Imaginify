import { prisma } from "@/lib/database/prisma";
import { PriceBookEntryForm } from "@/components/admin/PriceBookEntryForm";
import Link from "next/link";
import { Plus, DollarSign } from "lucide-react";

async function getAllPriceBookEntries() {
  return prisma.priceBookEntry.findMany({
    orderBy: [
      { pipelineKey: "asc" },
    ],
  });
}

export async function PriceBookContent() {
  const entries = await getAllPriceBookEntries();

  return (
    <div className="mt-8">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Price Book Entries</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage credit costs for pipeline types
          </p>
        </div>
        <Link
          href="/admin/price-book/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </Link>
      </div>

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
  );
}
