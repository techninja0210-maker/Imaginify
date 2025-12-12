"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubscriptionPlanModal } from "@/components/admin/SubscriptionPlanModal";
import { Plus, CreditCard, Users, Edit } from "lucide-react";
import { format } from "date-fns";
import { TableLoader } from "@/components/shared/Loader";

interface SubscriptionPlan {
  id: string;
  planFamily: string;
  version: number;
  internalId: string;
  publicName: string;
  priceUsd: number;
  creditsPerCycle: number;
  creditExpiryDays: number;
  stripePriceId: string | null;
  stripeProductId: string | null;
  isActiveForNewSignups: boolean;
  isLegacyOnly: boolean;
  isHidden: boolean;
  isDefaultForSignup: boolean;
  createdAt: string | Date;
  subscriptions: Array<{ id: string }>;
}

export default function SubscriptionPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/subscription-plans");
      const data = await response.json();
      if (data.success && data.plans) {
        setPlans(data.plans || []);
      } else if (data.plans) {
        // Fallback if API doesn't return success flag
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setSelectedPlan(null);
    setIsModalOpen(true);
  };

  const totalActiveSubscribers = plans.reduce((sum, p) => sum + p.subscriptions.length, 0);
  const planFamilies = new Set(plans.map(p => p.planFamily)).size;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Subscription Plans</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage subscription plans with versioning and grandfathering
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
                <p className="text-2xl font-bold text-gray-900">{totalActiveSubscribers}</p>
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
                <p className="text-2xl font-bold text-gray-900">{planFamilies}</p>
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
                    Family & Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscribers
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
                      <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-900">No subscription plans</p>
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
                  plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{plan.publicName}</div>
                        <div className="text-xs text-gray-500">{plan.internalId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 capitalize">{plan.planFamily}</div>
                        <div className="text-xs text-gray-500">v{plan.version}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${plan.priceUsd.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {plan.creditsPerCycle.toLocaleString()} / cycle
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {plan.isActiveForNewSignups && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 w-fit">
                              Active
                            </span>
                          )}
                          {plan.isLegacyOnly && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 w-fit">
                              Legacy Only
                            </span>
                          )}
                          {plan.isHidden && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 w-fit">
                              Hidden
                            </span>
                          )}
                          {plan.isDefaultForSignup && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 w-fit">
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {plan.subscriptions.length} active
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <SubscriptionPlanModal
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
