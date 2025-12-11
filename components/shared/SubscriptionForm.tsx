"use client";

import { useState, useEffect } from "react";
import SubscribeButton from "./SubscribeButton";
import { AutoTopUpCheckbox } from "./AutoTopUpCheckbox";

interface SubscriptionFormProps {
  lineItems: Array<{ priceId: string; quantity: number }>;
  className?: string;
}

export function SubscriptionForm({ lineItems, className }: SubscriptionFormProps) {
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(true); // Pre-checked by default
  const [settings, setSettings] = useState<{
    triggerThreshold: number;
    topUpPlan: {
      id: string;
      priceUsd: number;
      creditsGranted: number;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        // Fetch settings from API endpoint instead of direct server action
        const response = await fetch("/api/admin/auto-top-up-settings");
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            setSettings({
              triggerThreshold: data.settings.triggerThreshold,
              topUpPlan: data.settings.topUpPlan,
            });
          } else {
            // Use defaults if no settings configured
            setSettings({
              triggerThreshold: 200,
              topUpPlan: {
                id: "",
                priceUsd: 10,
                creditsGranted: 1000,
              },
            });
          }
        } else {
          throw new Error("Failed to fetch settings");
        }
      } catch (error) {
        console.error("Failed to fetch auto top-up settings:", error);
        // Use defaults
        setSettings({
          triggerThreshold: 200,
          topUpPlan: {
            id: "",
            priceUsd: 10,
            creditsGranted: 1000,
          },
        });
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  if (loading || !settings) {
    return (
      <div className={className}>
        <SubscribeButton
          lineItems={lineItems}
          className={className}
          autoTopUpEnabled={autoTopUpEnabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {settings.topUpPlan && (
        <AutoTopUpCheckbox
          checked={autoTopUpEnabled}
          onCheckedChange={setAutoTopUpEnabled}
          triggerThreshold={settings.triggerThreshold}
          topUpCredits={settings.topUpPlan.creditsGranted}
          topUpPrice={settings.topUpPlan.priceUsd}
        />
      )}
      <SubscribeButton
        lineItems={lineItems}
        autoTopUpEnabled={autoTopUpEnabled}
        className={className}
      />
    </div>
  );
}

