"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * AutoSyncSubscription Component
 * Automatically syncs subscription when:
 * 1. Returning from Stripe checkout (success=1)
 * 2. Returning from Stripe Customer Portal (upgrade/downgrade)
 * 3. Page loads and detects subscription mismatch
 */
export function AutoSyncSubscription() {
  const searchParams = useSearchParams();
  const [hasSynced, setHasSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Only sync once per page load
    if (hasSynced || isSyncing) return;

    // Always check and sync on page load (handles both checkout returns and portal returns)
    // This automatically syncs when:
    // 1. Returning from Stripe checkout (success=1 in URL)
    // 2. Returning from Stripe Customer Portal (after upgrade/downgrade)
    // 3. Any subscription mismatch detected
    const checkAndSync = async () => {
      setIsSyncing(true);

      try {
        const response = await fetch("/api/subscription/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Check if sync actually changed something
          if (data.creditsGranted > 0 || data.isPlanChange) {
            console.log("[AUTO_SYNC] Subscription synced successfully:", {
              creditsGranted: data.creditsGranted,
              isPlanChange: data.isPlanChange,
              newBalance: data.newBalance,
              plan: data.subscription?.plan,
            });

            // Reload page after a short delay to show updated data
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            console.log("[AUTO_SYNC] Subscription already in sync");
          }
        } else {
          console.warn("[AUTO_SYNC] Sync check completed but no action needed:", data.message);
        }
      } catch (error) {
        console.error("[AUTO_SYNC] Error syncing subscription:", error);
        // Don't show error to user - this is background sync
      } finally {
        setIsSyncing(false);
        setHasSynced(true);
      }
    };

    // Auto-sync when:
    // 1. Returning from Stripe (success param)
    // 2. Always check on page load (handles portal returns and general mismatches)
    checkAndSync();
  }, [searchParams, hasSynced, isSyncing]);

  // This component doesn't render anything
  return null;
}

