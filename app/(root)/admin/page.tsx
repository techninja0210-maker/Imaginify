import Header from "@/components/shared/Header";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";
import { updateCredits } from "@/lib/actions/user.actions";
import { canUpdateUserCredits, canDeleteUsers, canUpdateUserRoles } from "@/lib/auth/roles";

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
    <>
      <Header 
        title="Admin Console" 
        subtitle={`Welcome ${currentUser.firstName || currentUser.username}! Role: ${currentUser.role}`} 
      />
      <section className="mt-10 space-y-6">
        <form className="flex gap-3" action="/admin" method="get">
          <input className="input-field w-full" placeholder="Search by email/name/Clerk ID" name="q" defaultValue={q} />
          <button className="btn" type="submit">Search</button>
        </form>

        <div className="space-y-4">
          {users.map((u) => {
            const org = u.organizationMembers?.[0]?.organization;
            const balance = u.creditBalance || 0; // Use user-scoped credits
            return (
              <div key={u.id} className="collection-card p-4 space-y-2">
                <div className="flex-between">
                  <div>
                    <div className="p-16-medium">
                      {u.firstName || u.username || u.email}
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        u.role === 'SUPER_ADMIN' ? 'bg-red-100 text-red-800' :
                        u.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="p-14-medium text-dark-400">{u.email} · {u.clerkId}</div>
                    <div className="p-12-medium text-dark-300">
                      Credits: {balance} | Status: {u.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap">
                  {/* Credit Management */}
                  {canUpdateUserCredits(currentUser.role) && (
                    <form action={async (formData) => {
                      "use server";
                      const delta = Number(formData.get("delta"));
                      if (!Number.isFinite(delta) || delta === 0) return;
                      await updateCredits(u.clerkId, delta, delta > 0 ? "admin grant" : "admin deduction");
                    }} className="flex gap-2">
                      <input className="input-field" type="number" step="1" name="delta" placeholder="(+/-) credits" />
                      <button className="btn" type="submit">Update Credits</button>
                    </form>
                  )}

                  {/* Role Management */}
                  {canUpdateUserRoles(currentUser.role) && (
                    <form action={async (formData) => {
                      "use server";
                      const newRole = formData.get("role") as string;
                      if (!newRole || newRole === u.role) return;
                      await prisma.user.update({
                        where: { id: u.id },
                        data: { role: newRole }
                      });
                    }} className="flex gap-2">
                      <select className="input-field" name="role" defaultValue={u.role}>
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>
                      <button className="btn" type="submit">Update Role</button>
                    </form>
                  )}

                  {/* User Deactivation */}
                  {canDeleteUsers(currentUser.role) && u.id !== currentUser.id && (
                    <form action={async (formData) => {
                      "use server";
                      const isActive = formData.get("isActive") === "true";
                      await prisma.user.update({
                        where: { id: u.id },
                        data: { isActive }
                      });
                    }} className="flex gap-2">
                      <input type="hidden" name="isActive" value={u.isActive ? "false" : "true"} />
                      <button 
                        className={`btn ${u.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`} 
                        type="submit"
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
          {!users.length && <div className="p-14-medium text-dark-400">No results</div>}
        </div>
      </section>
    </>
  );
};

export default AdminPage;



