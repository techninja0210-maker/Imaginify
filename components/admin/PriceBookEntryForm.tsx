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
    pipelineKey: string;
    creditCost: number;
    active: boolean;
  } | null;
}

export function PriceBookEntryForm({ entry }: PriceBookEntryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(!entry);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    pipelineKey: entry?.pipelineKey || "",
    creditCost: entry?.creditCost || 1,
    active: entry?.active ?? true,
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
          pipelineKey: "",
          creditCost: 1,
          active: true,
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
        <div className="flex-1 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Pipeline Key</p>
            <p className="text-sm font-semibold text-gray-900">{entry.pipelineKey}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Credit Cost</p>
            <p className="text-sm font-semibold text-gray-900">{entry.creditCost} credits</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                entry.active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {entry.active ? "Active" : "Inactive"}
            </span>
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
        {/* Pipeline Key */}
        <div>
          <Label htmlFor="pipelineKey">Pipeline Key</Label>
          <Input
            id="pipelineKey"
            value={formData.pipelineKey}
            onChange={(e) => setFormData({ ...formData, pipelineKey: e.target.value })}
            placeholder="e.g., text_to_video, image_to_video"
            disabled={!!entry}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Unique identifier for the pipeline type
          </p>
        </div>

        {/* Credit Cost */}
        <div>
          <Label htmlFor="creditCost">Credit Cost</Label>
          <Input
            id="creditCost"
            type="number"
            min="0"
            value={formData.creditCost}
            onChange={(e) => setFormData({ ...formData, creditCost: Number(e.target.value) })}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Number of credits required for this pipeline
          </p>
        </div>
      </div>

      {/* Active Status */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={formData.active}
          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
        />
        <Label htmlFor="active" className="cursor-pointer">
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
