"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Trash2, Edit2, X } from "lucide-react";

interface PriceBookEntryFormProps {
  entry?: {
    id: string;
    organizationId: string;
    actionKey: string;
    unitType: string;
    unitStep: number;
    retailCostPerUnit: number;
    internalCostFormula: string;
    isActive: boolean;
  } | null;
  organizations: Array<{
    id: string;
    name: string;
    clerkId: string;
  }>;
  organizationId?: string;
}

export function PriceBookEntryForm({
  entry,
  organizations,
  organizationId,
}: PriceBookEntryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!entry);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    organizationId: entry?.organizationId || organizationId || organizations[0]?.id || "",
    actionKey: entry?.actionKey || "",
    unitType: entry?.unitType || "units",
    unitStep: entry?.unitStep || 1,
    retailCostPerUnit: entry?.retailCostPerUnit || 1,
    internalCostFormula: entry?.internalCostFormula || "units * 0.5",
    isActive: entry?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const url = "/api/admin/price-book";
      const method = entry ? "PATCH" : "POST";
      const body = entry
        ? { id: entry.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save price book entry");
      }

      toast({
        title: "Success",
        description: entry ? "Price book entry updated successfully" : "Price book entry created successfully",
      });

      router.refresh();
      if (entry) {
        setIsEditing(false);
      } else {
        // Reset form for new entry
        setFormData({
          organizationId: organizationId || organizations[0]?.id || "",
          actionKey: "",
          unitType: "units",
          unitStep: 1,
          retailCostPerUnit: 1,
          internalCostFormula: "units * 0.5",
          isActive: true,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save price book entry",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!entry || !confirm("Are you sure you want to delete this price book entry?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch("/api/admin/price-book", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete price book entry");
      }

      toast({
        title: "Success",
        description: "Price book entry deleted successfully",
      });

      router.refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete price book entry",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isEditing && entry) {
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Action Key</p>
            <p className="text-sm font-semibold text-gray-900">{entry.actionKey}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Unit Type</p>
            <p className="text-sm font-semibold text-gray-900">{entry.unitType}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Retail Cost</p>
            <p className="text-sm font-semibold text-gray-900">
              {entry.retailCostPerUnit} credits/{entry.unitType}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                entry.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {entry.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-500 font-medium mb-1">Internal Cost Formula</p>
            <p className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
              {entry.internalCostFormula}
            </p>
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
            disabled={isDeleting}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
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
          {entry ? "Edit Price Book Entry" : "New Price Book Entry"}
        </h3>
        {entry && (
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
        {/* Organization */}
        <div>
          <Label htmlFor="organizationId">Organization</Label>
          <select
            id="organizationId"
            value={formData.organizationId}
            onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
            disabled={!!entry}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.clerkId})
              </option>
            ))}
          </select>
        </div>

        {/* Action Key */}
        <div>
          <Label htmlFor="actionKey">Action Key</Label>
          <Input
            id="actionKey"
            value={formData.actionKey}
            onChange={(e) => setFormData({ ...formData, actionKey: e.target.value })}
            placeholder="e.g., text_to_video"
            disabled={!!entry}
            required
          />
        </div>

        {/* Unit Type */}
        <div>
          <Label htmlFor="unitType">Unit Type</Label>
          <Input
            id="unitType"
            value={formData.unitType}
            onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
            placeholder="e.g., seconds, units, per_image"
            required
          />
        </div>

        {/* Unit Step */}
        <div>
          <Label htmlFor="unitStep">Unit Step</Label>
          <Input
            id="unitStep"
            type="number"
            min="1"
            value={formData.unitStep}
            onChange={(e) => setFormData({ ...formData, unitStep: Number(e.target.value) })}
            required
          />
        </div>

        {/* Retail Cost Per Unit */}
        <div>
          <Label htmlFor="retailCostPerUnit">Retail Cost Per Unit (Credits)</Label>
          <Input
            id="retailCostPerUnit"
            type="number"
            min="1"
            value={formData.retailCostPerUnit}
            onChange={(e) => setFormData({ ...formData, retailCostPerUnit: Number(e.target.value) })}
            required
          />
        </div>

        {/* Internal Cost Formula */}
        <div>
          <Label htmlFor="internalCostFormula">Internal Cost Formula</Label>
          <Input
            id="internalCostFormula"
            value={formData.internalCostFormula}
            onChange={(e) => setFormData({ ...formData, internalCostFormula: e.target.value })}
            placeholder="e.g., units * 0.8"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Formula: <code className="bg-gray-100 px-1 rounded">units * factor</code>
          </p>
        </div>
      </div>

      {/* Active Status */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={formData.isActive}
          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
        />
        <Label htmlFor="isActive" className="cursor-pointer">
          Active (entry will be used for pricing)
        </Label>
      </div>

      {/* Submit Button */}
      <div className="flex items-center gap-2 pt-2">
        <Button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isLoading ? "Saving..." : entry ? "Update Entry" : "Create Entry"}
        </Button>
        {entry && (
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={isDeleting}
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

