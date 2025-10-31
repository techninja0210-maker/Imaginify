"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface RoleUpdateFormProps {
  userId: string;
  currentRole: string;
  searchQuery: string;
}

export function RoleUpdateForm({ userId, currentRole, searchQuery }: RoleUpdateFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(currentRole);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!role || role === currentRole) {
      toast({
        title: "No Change",
        description: "Please select a different role.",
        variant: "destructive",
      });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/update-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, role }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update role");
        }

        toast({
          title: "✅ Success",
          description: `Role updated to ${role}.`,
          className: "success-toast",
        });

        router.refresh();
      } catch (error: any) {
        toast({
          title: "❌ Error",
          description: error?.message || "Failed to update role",
          variant: "destructive",
          className: "error-toast",
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Change Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isPending}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending || role === currentRole}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Updating..." : "Update Role"}
      </button>
    </form>
  );
}

