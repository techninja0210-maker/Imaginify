"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CreditUpdateForm } from "./CreditUpdateForm";
import { RoleUpdateForm } from "./RoleUpdateForm";
import { UserStatusForm } from "./UserStatusForm";
import { canUpdateUserCredits, canUpdateUserRoles, canDeleteUsers } from "@/lib/auth/roles";

interface UserEditModalProps {
  user: {
    id: string;
    clerkId: string;
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
    creditBalance: number;
    stripeCustomerId: string | null;
  };
  currentUser: {
    id: string;
    role: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
}

export function UserEditModal({
  user,
  currentUser,
  open,
  onOpenChange,
  searchQuery,
}: UserEditModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit User: {user.firstName || user.username || user.email}
          </DialogTitle>
          <DialogDescription>
            Manage user credits, role, and status
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">User Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Clerk ID</p>
                <p className="font-mono text-xs text-gray-600">{user.clerkId}</p>
              </div>
              <div>
                <p className="text-gray-500">Current Credits</p>
                <p className="font-semibold text-purple-600">
                  {(user as any).effectiveBalance?.toLocaleString() ?? user.creditBalance.toLocaleString()}
                </p>
                {(user as any).effectiveBalance && (user as any).effectiveBalance !== user.creditBalance && (
                  <p className="text-xs text-gray-400 mt-1">
                    (Base: {user.creditBalance.toLocaleString()})
                  </p>
                )}
              </div>
              <div>
                <p className="text-gray-500">Role</p>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    user.role === 'SUPER_ADMIN'
                      ? 'bg-red-100 text-red-700'
                      : user.role === 'ADMIN'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Credit Management */}
            {canUpdateUserCredits(currentUser.role) && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Credits</h4>
                <CreditUpdateForm
                  userId={user.id}
                  clerkId={user.clerkId}
                  currentBalance={(user as any).effectiveBalance ?? user.creditBalance}
                  searchQuery={searchQuery}
                />
              </div>
            )}

            {/* Role Management */}
            {canUpdateUserRoles(currentUser.role) && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Role</h4>
                <RoleUpdateForm
                  userId={user.id}
                  currentRole={user.role}
                  searchQuery={searchQuery}
                  viewerRole={currentUser.role}
                  viewerId={currentUser.id}
                />
              </div>
            )}

            {/* User Status */}
            {canDeleteUsers(currentUser.role) && user.id !== currentUser.id && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Status</h4>
                <UserStatusForm
                  userId={user.id}
                  isActive={user.isActive}
                  searchQuery={searchQuery}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

