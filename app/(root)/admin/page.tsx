import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { canUpdateUserCredits, canDeleteUsers, canUpdateUserRoles } from "@/lib/auth/roles";
import { CreditUpdateForm } from "@/components/admin/CreditUpdateForm";
import { RoleUpdateForm } from "@/components/admin/RoleUpdateForm";
import { UserStatusForm } from "@/components/admin/UserStatusForm";

export const dynamic = "force-dynamic";

async function findUsers(q: string) {
  if (!q) return [] as any[];
  return prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { clerkId: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      organizationMembers: { include: { organization: { include: { credits: true } } } },
    },
    take: 20,
  });
}

const AdminPage = async ({ searchParams }: { searchParams: { q?: string } }) => {
  // Require admin access
  const currentUser = await requireAdmin();

  const q = searchParams?.q || "";
  const users = await findUsers(q);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Console</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back, <span className="font-medium text-gray-700">{currentUser.firstName || currentUser.username}</span>
                <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-md bg-purple-100 text-purple-700">
                  {currentUser.role}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Search Bar */}
        <div className="mb-8">
          <form action="/admin" method="get" className="flex gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                name="q"
                defaultValue={q}
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
            <div className="text-center py-12">
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
    </div>
  );
};

export default AdminPage;
