import { prisma } from "@/lib/database/prisma";
import { PriceBookEntryForm } from "@/components/admin/PriceBookEntryForm";
import Link from "next/link";
import { Plus, DollarSign } from "lucide-react";

async function getAllPriceBookEntries() {
  return prisma.priceBookEntry.findMany({
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          clerkId: true,
        },
      },
    },
    orderBy: [
      { organizationId: "asc" },
      { actionKey: "asc" },
    ],
  });
}

async function getAllOrganizations() {
  return prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      clerkId: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function PriceBookContent() {
  const [entries, organizations] = await Promise.all([
    getAllPriceBookEntries(),
    getAllOrganizations(),
  ]);

  // Group entries by organization
  const entriesByOrg = entries.reduce((acc, entry) => {
    const orgId = entry.organizationId;
    if (!acc[orgId]) {
      acc[orgId] = {
        organization: entry.organization,
        entries: [],
      };
    }
    acc[orgId].entries.push(entry);
    return acc;
  }, {} as Record<string, { organization: any; entries: any[] }>);

  return (
    <div className="mt-8">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Price Book Entries</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage pricing configurations for all actions across organizations
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                {entries.filter((e) => e.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Organizations</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(entriesByOrg).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Price Book Entries by Organization */}
      {Object.keys(entriesByOrg).length === 0 ? (
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
        <div className="space-y-6">
          {Object.entries(entriesByOrg).map(([orgId, { organization, entries }]) => (
            <div key={orgId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{organization.name}</h2>
                    <p className="text-xs text-gray-500 font-mono mt-1">{organization.clerkId}</p>
                  </div>
                  <span className="px-3 py-1 text-sm font-medium rounded-md bg-purple-100 text-purple-700">
                    {entries.length} {entries.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                      <PriceBookEntryForm
                        entry={entry}
                        organizations={organizations}
                        organizationId={organization.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

