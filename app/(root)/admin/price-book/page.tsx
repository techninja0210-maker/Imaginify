import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, DollarSign, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

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
  const activeEntries = entries.filter((e) => e.active).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Price Book</h1>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
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
                <p className="text-2xl font-bold text-gray-900">{activeEntries}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Price Book Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pipeline Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-900">No price book entries</p>
                      <p className="text-xs text-gray-500 mt-1">Get started by creating your first entry.</p>
                      <Link
                        href="/admin/price-book/new"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Entry
                      </Link>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.pipelineKey}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{entry.description || "—"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.creditsCost} credits
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {entry.active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(entry.updatedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/price-book/${entry.id}/edit`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceBookPage;
