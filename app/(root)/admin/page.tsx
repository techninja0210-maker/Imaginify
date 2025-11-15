import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { canUpdateUserCredits, canDeleteUsers, canUpdateUserRoles } from "@/lib/auth/roles";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { UsersContent } from "@/components/admin/UsersContent";
import { PriceBookContent } from "@/components/admin/PriceBookContent";
import { FixMissingCreditsContent } from "@/components/admin/FixMissingCreditsContent";
import { TrendingImportContent } from "@/components/admin/TrendingImportContent";

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

const AdminPage = async ({ searchParams }: { searchParams: { q?: string; tab?: string } }) => {
  // Require admin access
  const currentUser = await requireAdmin();

  const q = searchParams?.q || "";
  const activeTab = searchParams?.tab || "users";
  const users = await findUsers(q);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <AdminTabs activeTab={activeTab} />

        {/* Tab Content */}
        {activeTab === "users" && (
          <UsersContent 
            users={users} 
            currentUser={currentUser}
            searchQuery={q}
          />
        )}

        {activeTab === "price-book" && <PriceBookContent />}

        {activeTab === "credits" && <FixMissingCreditsContent />}

        {activeTab === "trending" && <TrendingImportContent />}
      </div>
    </div>
  );
};

export default AdminPage;
