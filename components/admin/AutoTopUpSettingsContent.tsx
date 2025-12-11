"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AutoTopUpSettings {
  id?: string;
  triggerThreshold: number;
  topUpPlanId: string;
  topUpPlan?: {
    id: string;
    publicName: string;
    priceUsd: number;
    creditsGranted: number;
  };
  isActive: boolean;
}

interface TopUpPlan {
  id: string;
  publicName: string;
  priceUsd: number;
  creditsGranted: number;
}

export function AutoTopUpSettingsContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [topUpPlans, setTopUpPlans] = useState<TopUpPlan[]>([]);
  const [settings, setSettings] = useState<AutoTopUpSettings>({
    triggerThreshold: 200,
    topUpPlanId: "",
    isActive: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoadingSettings(true);
      const [settingsRes, plansRes] = await Promise.all([
        fetch("/api/admin/auto-top-up-settings"),
        fetch("/api/admin/top-up-plans"),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.settings) {
          setSettings(settingsData.settings);
        }
      }

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        if (plansData.plans) {
          // Filter active plans, but keep all for dropdown (we'll disable ones without Stripe Price ID)
          setTopUpPlans(plansData.plans.filter((p: any) => p.isActive));
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast({
        title: "Error",
        description: "Failed to load auto top-up settings",
        variant: "destructive",
      });
    } finally {
      setLoadingSettings(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = "/api/admin/auto-top-up-settings";
      const method = settings.id ? "PATCH" : "POST";
      const body = settings.id ? { id: settings.id, ...settings } : settings;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      toast({
        title: "Success",
        description: "Auto top-up settings saved successfully",
      });

      router.refresh();
      await fetchSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPlan = topUpPlans.find((p) => p.id === settings.topUpPlanId);

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">Auto Top-Up Settings</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure automatic credit top-up when user balances run low
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="triggerThreshold">Trigger Threshold (Credits)</Label>
            <Input
              id="triggerThreshold"
              type="number"
              min="0"
              value={settings.triggerThreshold}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  triggerThreshold: parseInt(e.target.value, 10) || 0,
                })
              }
              required
              className="mt-1"
            />
            <p className="mt-1 text-sm text-gray-500">
              Auto top-up triggers when user balance reaches this threshold
            </p>
          </div>

          <div>
            <Label htmlFor="topUpPlan">Top-Up Plan</Label>
            <Select
              value={settings.topUpPlanId}
              onValueChange={(value) =>
                setSettings({ ...settings, topUpPlanId: value })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a top-up plan" />
              </SelectTrigger>
              <SelectContent>
                {topUpPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id} disabled={!plan.stripePriceId}>
                    {plan.publicName} - ${plan.priceUsd} ({plan.creditsGranted.toLocaleString()} credits)
                    {!plan.stripePriceId && " ⚠️ (No Stripe Price ID)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPlan && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <strong>Selected Plan:</strong> When triggered, users will be charged ${selectedPlan.priceUsd.toFixed(2)} and receive {selectedPlan.creditsGranted.toLocaleString()} credits.
                </p>
                {!selectedPlan.stripePriceId && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
                    <strong>⚠️ Warning:</strong> This plan is missing a Stripe Price ID. 
                    <div className="mt-2">
                      <strong>To fix:</strong>
                      <ol className="list-decimal list-inside mt-1 space-y-1">
                        <li>Go to <a href="/admin/top-up-plans" className="underline font-medium">Top-Up Plans</a></li>
                        <li>Edit this plan and add the Stripe Price ID</li>
                        <li>Or create a new plan with a Stripe Price ID</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}
            {topUpPlans.length === 0 && (
              <p className="mt-2 text-sm text-orange-600">
                No active top-up plans found. Please create a top-up plan first.
              </p>
            )}
            {topUpPlans.length > 0 && topUpPlans.every(p => !p.stripePriceId) && (
              <p className="mt-2 text-sm text-orange-600 bg-orange-50 border border-orange-200 p-3 rounded-lg">
                <strong>⚠️ Warning:</strong> All top-up plans are missing Stripe Price IDs. 
                Please add Stripe Price IDs to your plans for auto top-up to work.
              </p>
            )}
          </div>

          <div className="pt-4 border-t">
            <Button 
              type="submit" 
              disabled={
                isLoading || 
                !settings.topUpPlanId || 
                (selectedPlan && !selectedPlan.stripePriceId)
              } 
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
            {selectedPlan && !selectedPlan.stripePriceId && (
              <p className="mt-2 text-sm text-red-600">
                Cannot save: Selected plan is missing Stripe Price ID
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

