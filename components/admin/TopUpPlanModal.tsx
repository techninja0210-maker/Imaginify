"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TopUpPlanForm } from "./TopUpPlanForm";

interface TopUpPlanModalProps {
  plan?: {
    id: string;
    internalId: string;
    publicName: string;
    priceUsd: number;
    creditsGranted: number;
    creditExpiryDays: number;
    stripePriceId: string | null;
    stripeProductId: string | null;
    canPurchaseWithoutSubscription: boolean;
    isActive: boolean;
    isHidden: boolean;
    purchases?: Array<{ id: string }>;
    autoTopUpSettings?: Array<{ id: string; isActive: boolean }>;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TopUpPlanModal({
  plan,
  open,
  onOpenChange,
  onSuccess,
}: TopUpPlanModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Edit Top-Up Plan" : "New Top-Up Plan"}
          </DialogTitle>
          <DialogDescription>
            {plan
              ? "Update top-up plan settings"
              : "Create a new one-time credit pack"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <TopUpPlanForm 
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

