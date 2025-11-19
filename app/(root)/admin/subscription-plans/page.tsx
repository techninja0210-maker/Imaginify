import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import Link from "next/link";
import { ArrowLeft, Plus, CreditCard, Users } from "lucide-react";
import { SubscriptionPlanForm } from "@/components/admin/SubscriptionPlanForm";

export const dynamic = "force-dynamic";

async function getAllSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({
    orderBy: [
      { planFamily: "asc" },
      { version: "desc" },
    ],
    include: {
      subscriptions: {
        where: { status: "ACTIVE" },
        select: { id: true },
      },
    },
  });
}

const SubscriptionPlansPage = async () => {
  await requireAdmin();

  const plans = await getAllSubscriptionPlans();

  // Group by plan family
  const plansByFamily = plans.reduce((acc, plan) => {
    if (!acc[plan.planFamily]) {
      acc[plan.planFamily] = [];
    }
    acc[plan.planFamily].push(plan);
    return acc;
  }, {} as Record<string, typeof plans>);

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
                <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage subscription plans with versioning and grandfathering
                </p>
              </div>
            </div>
            <Link
              href="/admin/subscription-plans/new"
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
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Plans</p>
                <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Active Subscribers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {plans.reduce((sum, p) => sum + p.subscriptions.length, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Plan Families</p>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(plansByFamily).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans by Family */}
        {Object.keys(plansByFamily).length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No subscription plans</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first plan.</p>
            <Link
              href="/admin/subscription-plans/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Plan
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(plansByFamily).map(([family, familyPlans]) => (
              <div key={family} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900 capitalize">{family} Plans</h2>
                  <p className="text-xs text-gray-500 mt-1">{familyPlans.length} version(s)</p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {familyPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                      >
                        <SubscriptionPlanForm plan={plan} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPlansPage;

