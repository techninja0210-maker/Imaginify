"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SyncSubscriptionButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/subscription/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync subscription");
      }

      if (data.success) {
        setMessage(
          data.creditsGranted > 0
            ? `Subscription synced! ${data.creditsGranted} credits granted. New balance: ${data.newBalance}`
            : data.isPlanChange
            ? `Subscription synced! Plan updated to ${data.subscription.plan}.`
            : "Subscription is already up to date."
        );
        
        // Refresh the page after a short delay to show updated data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage("No subscription found to sync.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while syncing subscription");
      console.error("[SYNC_BUTTON] Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSync}
        disabled={isSyncing}
        variant="outline"
        size="sm"
        className="w-full"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "Syncing..." : "Refresh Subscription"}
      </Button>
      
      {message && (
        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
          {message}
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

