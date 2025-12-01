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
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-gray-100 rounded"></div>
          <div className="h-24 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-sm text-red-600">
          {error || "Unable to load credit breakdown"}
        </p>
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
    <div className="space-y-4">
      {/* Summary Cards - Simple */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-gray-50 rounded border">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-xl font-semibold text-gray-900">
            {data.totalAvailable.toLocaleString()}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded border">
          <p className="text-xs text-gray-500 mb-1">Subscription</p>
          <p className="text-xl font-semibold text-gray-900">
            {data.subscriptionCredits.toLocaleString()}
          </p>
        </div>

        <div className="p-3 bg-gray-50 rounded border">
          <p className="text-xs text-gray-500 mb-1">Top-Up</p>
          <p className="text-xl font-semibold text-gray-900">
            {data.topUpCredits.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Credit Details - Simple */}
      {data.grants.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Credit Details</h3>
          {data.grants.map((grant) => {
            const percentage = (grant.available / grant.total) * 100;
            const isSubscription = grant.type === "SUBSCRIPTION";
            
            return (
              <div
                key={grant.id}
                className="p-4 border rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isSubscription ? (
                      <Calendar className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-green-600" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {isSubscription ? "Subscription" : "Top-Up"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {grant.available.toLocaleString()} / {grant.total.toLocaleString()}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full ${
                      isSubscription ? "bg-blue-600" : "bg-green-600"
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                
                <p className="text-xs text-gray-500">
                  Expires {formatDate(grant.expiresAt)} ({grant.expiresInDays} {grant.expiresInDays === 1 ? "day" : "days"})
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Expiring Soon Warning - Simple */}
      {data.expiringSoon.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <h3 className="text-sm font-medium text-yellow-900">Credits Expiring Soon</h3>
          </div>
          <div className="space-y-2">
            {data.expiringSoon.map((grant) => (
              <div key={grant.id} className="text-sm">
                <p className="text-yellow-900">
                  {grant.available.toLocaleString()} credits expiring in {grant.expiresInDays} {grant.expiresInDays === 1 ? "day" : "days"}
                </p>
                <p className="text-xs text-yellow-700">
                  {formatDate(grant.expiresAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.grants.length === 0 && (
        <div className="text-center py-8">
          <CreditCard className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No active credit grants</p>
        </div>
      )}
    </div>
  );
}
