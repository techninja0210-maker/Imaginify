"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Trash2, Edit2, X, AlertTriangle } from "lucide-react";

interface SubscriptionPlanFormProps {
  onSuccess?: () => void;
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
    upgradeAllowedTo: string[];
    downgradeAllowedTo: string[];
    subscriptions?: Array<{ id: string }>;
  } | null;
}

export function SubscriptionPlanForm({ plan, onSuccess }: SubscriptionPlanFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(true); // Always start in edit mode for dedicated edit pages
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    planFamily: plan?.planFamily || "basic",
    version: plan?.version || 1,
    internalId: plan?.internalId || "",
    publicName: plan?.publicName || "",
    priceUsd: plan?.priceUsd || 0,
    creditsPerCycle: plan?.creditsPerCycle || 0,
    creditExpiryDays: plan?.creditExpiryDays || 30,
    stripePriceId: plan?.stripePriceId || "",
    stripeProductId: plan?.stripeProductId || "",
    isActiveForNewSignups: plan?.isActiveForNewSignups ?? true,
    isLegacyOnly: plan?.isLegacyOnly ?? false,
    isHidden: plan?.isHidden ?? false,
    isDefaultForSignup: plan?.isDefaultForSignup ?? false,
    upgradeAllowedTo: plan?.upgradeAllowedTo?.join(", ") || "",
    downgradeAllowedTo: plan?.downgradeAllowedTo?.join(", ") || "",
  });

  const activeSubscriberCount = plan?.subscriptions?.length || 0;
  const hasActiveSubscribers = activeSubscriberCount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = "/api/admin/subscription-plans";
      const method = plan ? "PATCH" : "POST";
      const body = plan
        ? {
            id: plan.id,
            ...formData,
            upgradeAllowedTo: formData.upgradeAllowedTo
              ? formData.upgradeAllowedTo.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
            downgradeAllowedTo: formData.downgradeAllowedTo
              ? formData.downgradeAllowedTo.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
          }
        : {
            ...formData,
            upgradeAllowedTo: formData.upgradeAllowedTo
              ? formData.upgradeAllowedTo.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
            downgradeAllowedTo: formData.downgradeAllowedTo
              ? formData.downgradeAllowedTo.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save subscription plan");
      }

      if (data.warning) {
        toast({
          title: "Warning",
          description: data.warning,
          variant: "default",
        });
      } else {
        toast({
          title: "Success",
          description: plan
            ? "Subscription plan updated successfully"
            : "Subscription plan created successfully",
        });
      }

      if (onSuccess) {
        onSuccess();
      }
      router.refresh();
      if (plan) {
        setIsEditing(false);
      } else {
        // Reset form
        setFormData({
          planFamily: "basic",
          version: 1,
          internalId: "",
          publicName: "",
          priceUsd: 0,
          creditsPerCycle: 0,
          creditExpiryDays: 30,
          stripePriceId: "",
          stripeProductId: "",
          isActiveForNewSignups: true,
          isLegacyOnly: false,
          isHidden: false,
          isDefaultForSignup: false,
          upgradeAllowedTo: "",
          downgradeAllowedTo: "",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save subscription plan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!plan || !confirm("Are you sure you want to delete this subscription plan?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch("/api/admin/subscription-plans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete subscription plan");
      }

      toast({
        title: "Success",
        description: "Subscription plan deleted successfully",
      });

      // Refresh via window reload since we're in a modal
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subscription plan",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isEditing && plan) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Plan Name</p>
            <p className="text-sm font-semibold text-gray-900">{plan.publicName}</p>
            <p className="text-xs text-gray-400 font-mono mt-1">{plan.internalId}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Price</p>
            <p className="text-sm font-semibold text-gray-900">${plan.priceUsd}/mo</p>
            <p className="text-xs text-gray-400 mt-1">{plan.creditsPerCycle} credits/cycle</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {plan.isLegacyOnly && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                  Legacy
                </span>
              )}
              {plan.isActiveForNewSignups && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              )}
              {plan.isHidden && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  Hidden
                </span>
              )}
              {plan.isDefaultForSignup && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                  Default
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Subscribers</p>
            <p className="text-sm font-semibold text-gray-900">{activeSubscriberCount}</p>
            <p className="text-xs text-gray-400 mt-1">v{plan.version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting || hasActiveSubscribers}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            title={hasActiveSubscribers ? "Cannot delete plan with active subscribers" : ""}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {plan ? "Edit Subscription Plan" : "New Subscription Plan"}
        </h3>
        {plan && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
        )}
      </div>

      {hasActiveSubscribers && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">This plan has {activeSubscriberCount} active subscriber(s).</p>
            <p className="text-xs mt-1">
              Changing credits, price, or expiry may affect existing users. Consider creating a new version instead.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan Family */}
        <div>
          <Label htmlFor="planFamily">Plan Family</Label>
          <Input
            id="planFamily"
            value={formData.planFamily}
            onChange={(e) => setFormData({ ...formData, planFamily: e.target.value })}
            placeholder="e.g., basic, pro, enterprise"
            disabled={!!plan}
            required
          />
        </div>

        {/* Version */}
        <div>
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            type="number"
            min="1"
            value={formData.version}
            onChange={(e) => setFormData({ ...formData, version: Number(e.target.value) })}
            disabled={!!plan}
            required
          />
        </div>

        {/* Internal ID */}
        <div>
          <Label htmlFor="internalId">Internal ID</Label>
          <Input
            id="internalId"
            value={formData.internalId}
            onChange={(e) => setFormData({ ...formData, internalId: e.target.value })}
            placeholder="e.g., sub_basic_v1"
            disabled={!!plan}
            required
          />
        </div>

        {/* Public Name */}
        <div>
          <Label htmlFor="publicName">Public Name</Label>
          <Input
            id="publicName"
            value={formData.publicName}
            onChange={(e) => setFormData({ ...formData, publicName: e.target.value })}
            placeholder="e.g., Starter Plan"
            required
          />
        </div>

        {/* Price USD */}
        <div>
          <Label htmlFor="priceUsd">Price (USD)</Label>
          <Input
            id="priceUsd"
            type="number"
            step="0.01"
            min="0"
            value={formData.priceUsd}
            onChange={(e) => setFormData({ ...formData, priceUsd: Number(e.target.value) })}
            required
          />
        </div>

        {/* Credits Per Cycle */}
        <div>
          <Label htmlFor="creditsPerCycle">Credits Per Cycle</Label>
          <Input
            id="creditsPerCycle"
            type="number"
            min="0"
            value={formData.creditsPerCycle}
            onChange={(e) => setFormData({ ...formData, creditsPerCycle: Number(e.target.value) })}
            required
          />
        </div>

        {/* Credit Expiry Days */}
        <div>
          <Label htmlFor="creditExpiryDays">Credit Expiry (Days)</Label>
          <Input
            id="creditExpiryDays"
            type="number"
            min="1"
            value={formData.creditExpiryDays}
            onChange={(e) => setFormData({ ...formData, creditExpiryDays: Number(e.target.value) })}
            required
          />
          <p className="text-xs text-gray-500 mt-1">Default: 30 days for subscriptions</p>
        </div>

        {/* Stripe Price ID */}
        <div>
          <Label htmlFor="stripePriceId">Stripe Price ID (optional)</Label>
          <Input
            id="stripePriceId"
            value={formData.stripePriceId}
            onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
            placeholder="price_xxxxx"
          />
        </div>

        {/* Stripe Product ID */}
        <div>
          <Label htmlFor="stripeProductId">Stripe Product ID (optional)</Label>
          <Input
            id="stripeProductId"
            value={formData.stripeProductId}
            onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
            placeholder="prod_xxxxx"
          />
        </div>

        {/* Upgrade Allowed To */}
        <div>
          <Label htmlFor="upgradeAllowedTo">Upgrade Allowed To (comma-separated plan IDs)</Label>
          <Input
            id="upgradeAllowedTo"
            value={formData.upgradeAllowedTo}
            onChange={(e) => setFormData({ ...formData, upgradeAllowedTo: e.target.value })}
            placeholder="plan_id_1, plan_id_2"
          />
        </div>

        {/* Downgrade Allowed To */}
        <div>
          <Label htmlFor="downgradeAllowedTo">Downgrade Allowed To (comma-separated plan IDs)</Label>
          <Input
            id="downgradeAllowedTo"
            value={formData.downgradeAllowedTo}
            onChange={(e) => setFormData({ ...formData, downgradeAllowedTo: e.target.value })}
            placeholder="plan_id_1, plan_id_2"
          />
        </div>
      </div>

      {/* Status Flags */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActiveForNewSignups"
            checked={formData.isActiveForNewSignups}
            onChange={(e) =>
              setFormData({ ...formData, isActiveForNewSignups: e.target.checked })
            }
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <Label htmlFor="isActiveForNewSignups" className="cursor-pointer">
            Active for new signups
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isLegacyOnly"
            checked={formData.isLegacyOnly}
            onChange={(e) => setFormData({ ...formData, isLegacyOnly: e.target.checked })}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <Label htmlFor="isLegacyOnly" className="cursor-pointer">
            Legacy only (existing subscribers only)
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isHidden"
            checked={formData.isHidden}
            onChange={(e) => setFormData({ ...formData, isHidden: e.target.checked })}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <Label htmlFor="isHidden" className="cursor-pointer">
            Hidden from UI (for testing/internal)
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isDefaultForSignup"
            checked={formData.isDefaultForSignup}
            onChange={(e) => setFormData({ ...formData, isDefaultForSignup: e.target.checked })}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <Label htmlFor="isDefaultForSignup" className="cursor-pointer">
            Default for public signup
          </Label>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={isLoading} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          {isLoading ? "Saving..." : plan ? "Update Plan" : "Create Plan"}
        </Button>
        {plan && (
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting || hasActiveSubscribers}
            className="flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </form>
  );
}

