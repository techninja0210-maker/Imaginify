"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface UserStatusFormProps {
  userId: string;
  isActive: boolean;
  searchQuery: string;
}

export function UserStatusForm({ userId, isActive, searchQuery }: UserStatusFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, isActive: !isActive }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update status");
        }

        toast({
          title: "✅ Success",
          description: `User ${!isActive ? "activated" : "deactivated"} successfully.`,
          className: "success-toast",
        });

        router.refresh();
      } catch (error: any) {
        toast({
          title: "❌ Error",
          description: error?.message || "Failed to update status",
          variant: "destructive",
          className: "error-toast",
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">User Status</label>
        <button
          type="submit"
          disabled={isPending}
          className={`w-full px-4 py-2 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive
              ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
              : "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500"
          }`}
        >
          {isPending ? "Updating..." : isActive ? "Deactivate User" : "Activate User"}
        </button>
      </div>
    </form>
  );
}

