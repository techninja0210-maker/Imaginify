import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { PriceBookEntryForm } from "@/components/admin/PriceBookEntryForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

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

const NewPriceBookPage = async () => {
  await requireAdmin();

  const organizations = await getAllOrganizations();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/price-book"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Back to Price Book"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">New Price Book Entry</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create a new pricing configuration
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <PriceBookEntryForm
            entry={null}
            organizations={organizations}
          />
        </div>
      </div>
    </div>
  );
};

export default NewPriceBookPage;

