"use client";

import { useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface RoleUpdateFormProps {
  userId: string;
  currentRole: string;
  searchQuery: string;
  viewerRole: string;
  viewerId: string;
}

export function RoleUpdateForm({ userId, currentRole, searchQuery, viewerRole, viewerId }: RoleUpdateFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(currentRole);

  const isViewerSuperAdmin = viewerRole === "SUPER_ADMIN";
  const isTargetSuperAdmin = currentRole === "SUPER_ADMIN";
  const isSelf = userId === viewerId;

  const allowedRoles = useMemo(() => {
    if (isViewerSuperAdmin) {
      return ["USER", "ADMIN", "SUPER_ADMIN"];
    }
    return ["USER", "ADMIN"];
  }, [isViewerSuperAdmin]);

  const canModifyTarget = useMemo(() => {
    if (isViewerSuperAdmin) {
      return true;
    }

    if (isTargetSuperAdmin) {
      return false;
    }

    return !isSelf;
  }, [isViewerSuperAdmin, isTargetSuperAdmin, isSelf]);

  const selectOptions = canModifyTarget ? allowedRoles : [currentRole];
  const selectedRole = selectOptions.includes(role) ? role : currentRole;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedRole || selectedRole === currentRole) {
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
          body: JSON.stringify({ userId, role: selectedRole }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update role");
        }

        toast({
          title: "✅ Success",
          description: data?.message || `Role updated to ${selectedRole}.`,
          className: "success-toast",
        });

        setRole(selectedRole);
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
          value={selectedRole}
          onChange={(e) => setRole(e.target.value)}
          disabled={isPending || !canModifyTarget}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {selectOptions.map((option) => (
            <option key={option} value={option}>
              {option === "SUPER_ADMIN" ? "Super Admin" : option.charAt(0) + option.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        {!canModifyTarget && (
          <p className="mt-2 text-xs text-gray-500">
            {isSelf
              ? "You cannot change your own role."
              : "Only super admins can modify super admin accounts."}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending || selectedRole === currentRole || !canModifyTarget}
        className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Updating..." : "Update Role"}
      </button>
    </form>
  );
}

