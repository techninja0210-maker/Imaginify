"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { InlineLoader } from "@/components/shared/Loader";

export function FixMissingCreditsContent() {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<any>(null);

  const handleGrantMissingCredits = () => {
    if (!confirm("This will grant credits for all paid Stripe checkout sessions that don't have ledger entries. Continue?")) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/grant-all-missing-credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to grant missing credits");
        }

        setResult(data);

        toast({
          title: "✅ Success",
          description: `Granted credits for ${data.summary?.granted || 0} sessions. ${data.summary?.skipped || 0} skipped, ${data.summary?.errors || 0} errors.`,
          className: "success-toast",
        });

        // Refresh data
        router.refresh();
      } catch (error: any) {
        const errorMsg = error?.message || "Failed to grant missing credits";
        toast({
          title: "❌ Error",
          description: errorMsg,
          variant: "destructive",
          className: "error-toast",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Fix Missing Credits</h2>
        <p className="mt-1 text-sm text-gray-500">
          Grant credits for Stripe purchases that don&apos;t have ledger entries yet.
        </p>
      </div>

      {/* Action Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Grant Missing Credits
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This will scan all Stripe checkout sessions and grant credits for any paid sessions
                that don&apos;t have corresponding ledger entries in the database.
              </p>
              <ul className="text-sm text-gray-500 space-y-1 mb-4">
                <li>• Only processes paid sessions</li>
                <li>• Skips sessions that already have credits granted</li>
                <li>• Uses idempotency to prevent duplicate grants</li>
                <li>• Processes up to 100 recent sessions</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleGrantMissingCredits}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <InlineLoader text="Processing..." size="sm" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Grant Missing Credits
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
            
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Total Sessions</div>
                <div className="text-2xl font-bold text-gray-900">{result.summary?.total || 0}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600">Granted</div>
                <div className="text-2xl font-bold text-green-700">{result.summary?.granted || 0}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600">Skipped</div>
                <div className="text-2xl font-bold text-yellow-700">{result.summary?.skipped || 0}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-red-600">Errors</div>
                <div className="text-2xl font-bold text-red-700">{result.summary?.errors || 0}</div>
              </div>
            </div>

            {/* Detailed Results */}
            {result.results && result.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Session Details</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {result.results.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {item.status === "granted" && (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          )}
                          {item.status === "already_granted" && (
                            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                          )}
                          {item.status === "skipped" && (
                            <AlertCircle className="w-4 h-4 text-gray-600 flex-shrink-0" />
                          )}
                          {item.status === "error" && (
                            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.sessionId || item.chargeId}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.status === "granted"
                                ? "bg-green-100 text-green-700"
                                : item.status === "already_granted"
                                ? "bg-yellow-100 text-yellow-700"
                                : item.status === "skipped"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        {item.buyerId && (
                          <div className="text-xs text-gray-500 truncate">
                            User: {item.email || item.buyerId}
                          </div>
                        )}
                        {item.credits && (
                          <div className="text-xs text-gray-500">
                            Credits: {item.credits.toLocaleString()}
                            {item.newBalance && ` → Balance: ${item.newBalance.toLocaleString()}`}
                          </div>
                        )}
                        {item.reason && (
                          <div className="text-xs text-gray-500">Reason: {item.reason}</div>
                        )}
                        {item.error && (
                          <div className="text-xs text-red-600">Error: {item.error}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

