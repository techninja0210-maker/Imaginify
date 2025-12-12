"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopUpPlanModal } from "@/components/admin/TopUpPlanModal";
import { Plus, ShoppingCart, Edit } from "lucide-react";
import { format } from "date-fns";
import { TableLoader } from "@/components/shared/Loader";

interface TopUpPlan {
  id: string;
  internalId: string;
  publicName: string;
  priceUsd: number;
  creditsGranted: number;
  creditExpiryDays: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  canPurchaseWithoutSubscription: boolean;
  isActive: boolean;
  isHidden: boolean;
  createdAt: string | Date;
  purchases: Array<{ id: string }>;
  autoTopUpSettings: Array<{ id: string; isActive: boolean }>;
}

export default function TopUpPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<TopUpPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<TopUpPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/top-up-plans");
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: TopUpPlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setSelectedPlan(null);
    setIsModalOpen(true);
  };

  const totalPurchases = plans.reduce((sum, p) => sum + p.purchases.length, 0);
  const activePlans = plans.filter((p) => p.isActive).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Top-Up Plans</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage one-time credit pack purchases
              </p>
            </div>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Plan
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
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
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Purchases</p>
                <p className="text-2xl font-bold text-gray-900">{totalPurchases}</p>
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
                <p className="text-2xl font-bold text-gray-900">{activePlans}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Plans Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Purchases
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <TableLoader colSpan={8} text="Loading plans..." />
                ) : plans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-900">No top-up plans</p>
                      <p className="text-xs text-gray-500 mt-1">Get started by creating your first plan.</p>
                      <button
                        onClick={handleNew}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Plan
                      </button>
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => {
                    const isAutoTopUp = plan.autoTopUpSettings.some(s => s.isActive);
                    
                    return (
                      <tr key={plan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{plan.publicName}</div>
                          <div className="text-xs text-gray-500">{plan.internalId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${plan.priceUsd.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {plan.creditsGranted.toLocaleString()} credits
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{plan.creditExpiryDays} days</div>
                          <div className="text-xs text-gray-500">No sub required</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {plan.isActive && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 w-fit">
                                Active
                              </span>
                            )}
                            {isAutoTopUp && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 w-fit">
                                Auto Top-Up
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {plan.purchases.length} purchase{plan.purchases.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(plan.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(plan);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <TopUpPlanModal
        plan={selectedPlan || null}
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setSelectedPlan(null); // Clear selection when modal closes
          }
        }}
        onSuccess={() => {
          fetchPlans(); // Only refresh data after successful save
        }}
      />
    </div>
  );
}
