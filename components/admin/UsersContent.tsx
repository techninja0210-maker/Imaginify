"use client";

import { CreditUpdateForm } from "@/components/admin/CreditUpdateForm";
import { RoleUpdateForm } from "@/components/admin/RoleUpdateForm";
import { UserStatusForm } from "@/components/admin/UserStatusForm";
import { canUpdateUserCredits, canUpdateUserRoles, canDeleteUsers } from "@/lib/auth/roles";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface UsersContentProps {
  users: any[];
  currentUser: any;
  searchQuery: string;
}

export function UsersContent({ users, currentUser, searchQuery: q }: UsersContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(q);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <div className="mt-8">
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

      {/* Users List */}
      <div className="space-y-4">
        {users.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">Try searching with a different query.</p>
          </div>
        ) : (
          users.map((u) => {
            const balance = u.creditBalance || 0;
            return (
              <div
                key={u.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  {/* User Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                          {(u.firstName || u.username || u.email)?.[0]?.toUpperCase() || "U"}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {u.firstName || u.username || u.email}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                              u.role === 'SUPER_ADMIN'
                                ? 'bg-red-100 text-red-700'
                                : u.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {u.role}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                              u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{u.email}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{u.clerkId}</p>
                        {u.stripeCustomerId && (
                          <a
                            href={`https://dashboard.stripe.com/customers/${u.stripeCustomerId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View Stripe Customer
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-500">Credits</p>
                      <p className="text-2xl font-bold text-gray-900">{balance.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-4"></div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Credit Management */}
                    {canUpdateUserCredits(currentUser.role) && (
                      <CreditUpdateForm
                        userId={u.id}
                        clerkId={u.clerkId}
                        currentBalance={balance}
                        searchQuery={q}
                      />
                    )}

                    {/* Role Management */}
                    {canUpdateUserRoles(currentUser.role) && (
                      <RoleUpdateForm
                        userId={u.id}
                        currentRole={u.role}
                        searchQuery={q}
                        viewerRole={currentUser.role}
                        viewerId={currentUser.id}
                      />
                    )}

                    {/* User Deactivation */}
                    {canDeleteUsers(currentUser.role) && u.id !== currentUser.id && (
                      <UserStatusForm
                        userId={u.id}
                        isActive={u.isActive}
                        searchQuery={q}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

