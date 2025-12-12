"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { UserEditModal } from "./UserEditModal";
import { Users, Edit, Mail, CreditCard, UserCheck } from "lucide-react";
import { format } from "date-fns";

interface UsersContentProps {
  users: any[];
  currentUser: any;
  searchQuery: string;
}

export function UsersContent({ users, currentUser, searchQuery: q }: UsersContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(q);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "users");
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }
    router.push(`/admin?${params.toString()}`);
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  // Calculate total using effective balance if available
  const totalCredits = users.reduce((sum, u) => {
    const balance = (u as any).effectiveBalance ?? u.creditBalance ?? 0;
    return sum + balance;
  }, 0);

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-8">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email, name, or Clerk ID..."
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all"
          >
            Search
          </button>
        </form>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{activeUsers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Credits</p>
              <p className="text-2xl font-bold text-gray-900">{totalCredits.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Users className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm font-medium text-gray-900">No users found</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {q ? "Try searching with a different query." : "Users will appear here once they sign up."}
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const displayName = user.firstName || user.username || user.email;
                  const initials = displayName[0]?.toUpperCase() || "U";
                  // Use effectiveBalance if available (includes grants), otherwise fallback to creditBalance
                  const balance = (user as any).effectiveBalance ?? user.creditBalance ?? 0;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                              {initials}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{displayName}</div>
                            {user.username && (
                              <div className="text-xs text-gray-500">@{user.username}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.role === 'SUPER_ADMIN'
                              ? 'bg-red-100 text-red-800'
                              : user.role === 'ADMIN'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {balance.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(user.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleEdit(user);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {selectedUser && (
        <UserEditModal
          user={selectedUser}
          currentUser={currentUser}
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setSelectedUser(null);
              // Refresh page after modal closes to get updated data
              router.refresh();
            }
          }}
          searchQuery={q}
        />
      )}
    </div>
  );
}
