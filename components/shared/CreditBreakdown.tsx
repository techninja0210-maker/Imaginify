"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, AlertCircle, CreditCard } from "lucide-react";

interface CreditBreakdownData {
  totalAvailable: number;
  subscriptionCredits: number;
  topUpCredits: number;
  grants: Array<{
    id: string;
    type: "SUBSCRIPTION" | "TOPUP";
    available: number;
    total: number;
    used: number;
    expiresAt: string;
    expiresInDays: number;
  }>;
  subscription: {
    id: string;
    planName: string;
    status: string;
    currentPeriodEnd: string;
    renewsOn: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  expiringSoon: Array<{
    id: string;
    type: "SUBSCRIPTION" | "TOPUP";
    available: number;
    expiresAt: string;
    expiresInDays: number;
  }>;
  nextRenewal: string | null;
}

export function CreditBreakdown() {
  const [data, setData] = useState<CreditBreakdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/credits-breakdown")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setData(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          {error || "Unable to load credit breakdown"}
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Credits */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Credits</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.totalAvailable.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Subscription Credits */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Subscription</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.subscriptionCredits.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Top-Up Credits */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Top-Up</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.topUpCredits.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Info */}
      {data.subscription && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Active Subscription
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Plan</span>
              <span className="text-sm font-semibold text-gray-900">
                {data.subscription.planName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Renews On</span>
              <span className="text-sm font-semibold text-gray-900">
                {data.subscription.renewsOn}
              </span>
            </div>
            {data.subscription.cancelAtPeriodEnd && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Subscription will cancel at period end
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expiring Soon Warning */}
      {data.expiringSoon.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Credits Expiring Soon
          </h3>
          <div className="space-y-3">
            {data.expiringSoon.map((grant) => (
              <div
                key={grant.id}
                className="bg-white rounded-lg p-4 border border-yellow-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {grant.type === "SUBSCRIPTION" ? "Subscription" : "Top-Up"} Credits
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {grant.available.toLocaleString()} credits expiring
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-yellow-700">
                      {grant.expiresInDays} {grant.expiresInDays === 1 ? "day" : "days"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(grant.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credit Grants Details */}
      {data.grants.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Credit Details
          </h3>
          <div className="space-y-3">
            {data.grants.map((grant) => (
              <div
                key={grant.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        grant.type === "SUBSCRIPTION"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {grant.type === "SUBSCRIPTION" ? "Subscription" : "Top-Up"}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {grant.available.toLocaleString()} / {grant.total.toLocaleString()} credits
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Expires {formatDate(grant.expiresAt)}
                    </p>
                    <p className="text-xs text-gray-400">
                      ({grant.expiresInDays} {grant.expiresInDays === 1 ? "day" : "days"})
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      grant.type === "SUBSCRIPTION"
                        ? "bg-blue-500"
                        : "bg-green-500"
                    }`}
                    style={{
                      width: `${(grant.available / grant.total) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.grants.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500">
          No active credit grants found
        </div>
      )}
    </div>
  );
}

