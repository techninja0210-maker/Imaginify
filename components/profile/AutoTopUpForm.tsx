"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TrendingUp } from "lucide-react";

interface AutoTopUpFormProps {
  userId: string;
  currentSettings: {
    enabled: boolean;
    threshold: number;
    amount: number | null;
  };
}

export function AutoTopUpForm({ userId, currentSettings }: AutoTopUpFormProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(currentSettings.enabled);
  const [threshold, setThreshold] = useState(currentSettings.threshold);
  const [amount, setAmount] = useState(currentSettings.amount || 100);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/profile/auto-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          threshold: Number(threshold),
          amount: enabled ? Number(amount) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }

      toast({
        title: "Settings saved!",
        description: `Auto top-up ${enabled ? "enabled" : "disabled"}.`,
        className: "success-toast",
      });

      // Refresh page to show updated settings
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update auto top-up settings",
        className: "error-toast",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <div>
            <Label htmlFor="enabled" className="text-base font-semibold text-gray-900 cursor-pointer">
              Enable Auto Top-Up
            </Label>
            <p className="text-xs text-gray-500 mt-0.5">
              Automatically purchase credits when balance falls below threshold
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
        </label>
      </div>

      {/* Settings Form */}
      {enabled && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <Label htmlFor="threshold" className="text-sm font-semibold text-gray-700 mb-2 block">
              Low Balance Threshold
            </Label>
            <Input
              id="threshold"
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full"
              placeholder="10"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              When your balance falls below this number, auto top-up will trigger
            </p>
          </div>

          <div>
            <Label htmlFor="amount" className="text-sm font-semibold text-gray-700 mb-2 block">
              Credits to Purchase
            </Label>
            <Input
              id="amount"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full"
              placeholder="100"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Number of credits to automatically purchase when threshold is reached
            </p>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Settings"
        )}
      </Button>

      {/* Info Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Auto top-up requires a linked Stripe payment method. 
          Credits will be charged automatically when your balance drops below the threshold.
        </p>
      </div>
    </form>
  );
}
