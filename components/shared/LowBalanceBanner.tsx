"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, AlertTriangle, Coins } from "lucide-react";
import { useRouter } from "next/navigation";

interface LowBalanceStatus {
  isLow: boolean;
  currentBalance: number;
  threshold: number;
  emailSent?: boolean;
}

export function LowBalanceBanner() {
  const [status, setStatus] = useState<LowBalanceStatus | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if banner was dismissed in this session
    const dismissed = sessionStorage.getItem("lowBalanceBannerDismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
      setIsLoading(false);
      return;
    }

    // Fetch low balance status
    async function checkBalance() {
      try {
        const res = await fetch("/api/me/low-balance");
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        setStatus(data);
      } catch (error) {
        console.error("Error checking low balance:", error);
      } finally {
        setIsLoading(false);
      }
    }

    checkBalance();
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("lowBalanceBannerDismissed", "true");
  };

  const handleRefresh = () => {
    sessionStorage.removeItem("lowBalanceBannerDismissed");
    router.refresh();
    window.location.reload();
  };

  if (isLoading || isDismissed || !status?.isLow) {
    return null;
  }

  const creditsNeeded = status.threshold - status.currentBalance;

  return (
    <div className="w-full bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-b-2 border-amber-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  Low Credit Balance
                </h3>
                <p className="text-sm text-amber-800 mb-3">
                  Your balance is <strong>{status.currentBalance.toLocaleString()} credits</strong>, which is below your threshold of <strong>{status.threshold.toLocaleString()} credits</strong>.
                  {creditsNeeded > 0 && (
                    <span> You need at least <strong>{creditsNeeded.toLocaleString()} more credits</strong> to reach your threshold.</span>
                  )}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href="/credits"
                    className="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
                  >
                    Buy More Credits
                  </Link>
                  <Link
                    href="/billing"
                    className="inline-flex items-center px-4 py-2 bg-white text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors border border-amber-300"
                  >
                    Manage Settings
                  </Link>
                </div>
                {status.emailSent && (
                  <p className="text-xs text-amber-700 mt-2">
                    ✓ Email notification sent
                  </p>
                )}
              </div>

              {/* Dismiss Button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-amber-100 transition-colors text-amber-600 hover:text-amber-800"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

