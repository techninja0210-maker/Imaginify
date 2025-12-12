"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubscriptionPlanForm } from "./SubscriptionPlanForm";

interface SubscriptionPlanModalProps {
  plan?: {
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
    upgradeAllowedTo?: string[];
    downgradeAllowedTo?: string[];
    subscriptions?: Array<{ id: string }>;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SubscriptionPlanModal({
  plan,
  open,
  onOpenChange,
  onSuccess,
}: SubscriptionPlanModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Edit Subscription Plan" : "New Subscription Plan"}
          </DialogTitle>
          <DialogDescription>
            {plan
              ? "Update subscription plan settings"
              : "Create a new subscription plan with versioning support"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <SubscriptionPlanForm 
            plan={plan || undefined} 
            onSuccess={() => {
              onOpenChange(false);
              if (onSuccess) {
                onSuccess();
              }
            }} 
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

