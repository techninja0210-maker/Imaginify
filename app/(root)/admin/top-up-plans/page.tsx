import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, CreditCard, ShoppingCart } from "lucide-react";
import { TopUpPlanForm } from "@/components/admin/TopUpPlanForm";

export const dynamic = "force-dynamic";

async function getAllTopUpPlans() {
  return prisma.topUpPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      purchases: {
        select: { id: true },
      },
      autoTopUpSettings: {
        select: { id: true, isActive: true },
      },
    },
  });
}

const TopUpPlansPage = async () => {
  await requireAdmin();

  const plans = await getAllTopUpPlans();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Back to Admin Console"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Top-Up Plans</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage one-time credit pack purchases
                </p>
              </div>
            </div>
            <Link
              href="/admin/top-up-plans/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Plan
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Plans</p>
                <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Purchases</p>
                <p className="text-2xl font-bold text-gray-900">
                  {plans.reduce((sum, p) => sum + p.purchases.length, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Active Plans</p>
                <p className="text-2xl font-bold text-gray-900">
                  {plans.filter((p) => p.isActive).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans List */}
        {plans.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No top-up plans</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first plan.</p>
            <Link
              href="/admin/top-up-plans/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Plan
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
              >
                <TopUpPlanForm plan={plan} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TopUpPlansPage;

