"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Trash2, Edit2, X } from "lucide-react";

interface TopUpPlanFormProps {
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
}

export function TopUpPlanForm({ plan }: TopUpPlanFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!plan);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    internalId: plan?.internalId || "",
    publicName: plan?.publicName || "",
    priceUsd: plan?.priceUsd || 0,
    creditsGranted: plan?.creditsGranted || 0,
    creditExpiryDays: plan?.creditExpiryDays || 365,
    stripePriceId: plan?.stripePriceId || "",
    stripeProductId: plan?.stripeProductId || "",
    canPurchaseWithoutSubscription: plan?.canPurchaseWithoutSubscription ?? true,
    isActive: plan?.isActive ?? true,
    isHidden: plan?.isHidden ?? false,
  });

  const purchaseCount = plan?.purchases?.length || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = "/api/admin/top-up-plans";
      const method = plan ? "PATCH" : "POST";
      const body = plan ? { id: plan.id, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save top-up plan");
      }

      toast({
        title: "Success",
        description: plan
          ? "Top-up plan updated successfully"
          : "Top-up plan created successfully",
      });

      router.refresh();
      if (plan) {
        setIsEditing(false);
      } else {
        // Reset form
        setFormData({
          internalId: "",
          publicName: "",
          priceUsd: 0,
          creditsGranted: 0,
          creditExpiryDays: 365,
          stripePriceId: "",
          stripeProductId: "",
          canPurchaseWithoutSubscription: true,
          isActive: true,
          isHidden: false,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save top-up plan",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!plan || !confirm("Are you sure you want to delete this top-up plan?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch("/api/admin/top-up-plans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Pass the full error data so we can access it in catch block
        const error = new Error(data.error || "Failed to delete top-up plan") as any;
        error.responseData = data;
        throw error;
      }

      toast({
        title: "Success",
        description: data.warning || "Top-up plan deleted successfully",
      });

      if (data.warning) {
        setTimeout(() => {
          toast({
            title: "Note",
            description: data.warning,
            duration: 6000,
          });
        }, 500);
      }

      router.refresh();
    } catch (error: any) {
      const errorData = error.responseData || {};
      const errorMessage = errorData.message || errorData.error || error.message || "Failed to delete top-up plan";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 10000, // Show longer for helpful error messages
      });

      // If the error has details about auto top-up settings, show additional help
      if (errorData.details?.activeSettingsCount > 0) {
        setTimeout(() => {
          toast({
            title: "How to Fix",
            description: `This plan is used in Auto Top-Up Settings. Go to /admin?tab=auto-top-up and change to a different plan first, then try deleting again.`,
            duration: 10000,
          });
        }, 1500);
      }
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
            <p className="text-sm font-semibold text-gray-900">${plan.priceUsd}</p>
            <p className="text-xs text-gray-400 mt-1">{plan.creditsGranted} credits</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Expiry</p>
            <p className="text-sm font-semibold text-gray-900">{plan.creditExpiryDays} days</p>
            <p className="text-xs text-gray-400 mt-1">
              {plan.canPurchaseWithoutSubscription ? "No sub required" : "Sub required"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {plan.isActive && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              )}
              {plan.isHidden && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  Hidden
                </span>
              )}
              {plan.autoTopUpSettings && plan.autoTopUpSettings.some(s => s.isActive) && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700" title="Used in Auto Top-Up Settings">
                  Auto Top-Up
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">{purchaseCount} purchase(s)</p>
            {plan.autoTopUpSettings && plan.autoTopUpSettings.some(s => s.isActive) && (
              <p className="text-xs text-orange-600 mt-1">
                ⚠️ Used in Auto Top-Up Settings
              </p>
            )}
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
            disabled={isDeleting || (plan.autoTopUpSettings && plan.autoTopUpSettings.some(s => s.isActive))}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              plan.autoTopUpSettings && plan.autoTopUpSettings.some(s => s.isActive)
                ? "Cannot delete: Plan is used in Auto Top-Up Settings. Change Auto Top-Up Settings first."
                : "Delete this plan"
            }
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
          {plan ? "Edit Top-Up Plan" : "New Top-Up Plan"}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Internal ID */}
        <div>
          <Label htmlFor="internalId">Internal ID</Label>
          <Input
            id="internalId"
            value={formData.internalId}
            onChange={(e) => setFormData({ ...formData, internalId: e.target.value })}
            placeholder="e.g., topup_5000_v1"
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
            placeholder="e.g., 5,000 Credit Boost"
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

        {/* Credits Granted */}
        <div>
          <Label htmlFor="creditsGranted">Credits Granted</Label>
          <Input
            id="creditsGranted"
            type="number"
            min="0"
            value={formData.creditsGranted}
            onChange={(e) => setFormData({ ...formData, creditsGranted: Number(e.target.value) })}
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
          <p className="text-xs text-gray-500 mt-1">Default: 365 days for top-ups</p>
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
      </div>

      {/* Status Flags */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="canPurchaseWithoutSubscription"
            checked={formData.canPurchaseWithoutSubscription}
            onChange={(e) =>
              setFormData({ ...formData, canPurchaseWithoutSubscription: e.target.checked })
            }
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <Label htmlFor="canPurchaseWithoutSubscription" className="cursor-pointer">
            Can be purchased without subscription
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <Label htmlFor="isActive" className="cursor-pointer">
            Active
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
            disabled={
              isDeleting || 
              (plan.autoTopUpSettings && plan.autoTopUpSettings.some(s => s.isActive))
            }
            className="flex items-center gap-2 text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              plan.autoTopUpSettings && plan.autoTopUpSettings.some(s => s.isActive)
                ? "Cannot delete: Plan is used in Auto Top-Up Settings. Change Auto Top-Up Settings first."
                : "Delete this plan"
            }
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </form>
  );
}

