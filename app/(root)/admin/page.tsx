import Header from "@/components/shared/Header";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { updateCredits } from "@/lib/actions/user.actions";

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
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const q = searchParams?.q || "";
  const users = await findUsers(q);

  return (
    <>
      <Header title="Admin Console" subtitle="Search users and adjust credits" />
      <section className="mt-10 space-y-6">
        <form className="flex gap-3" action="/admin" method="get">
          <input className="input-field w-full" placeholder="Search by email/name/Clerk ID" name="q" defaultValue={q} />
          <button className="btn" type="submit">Search</button>
        </form>

        <div className="space-y-4">
          {users.map((u) => {
            const org = u.organizationMembers?.[0]?.organization;
            const balance = org?.credits?.balance || 0;
            return (
              <div key={u.id} className="collection-card p-4 space-y-2">
                <div className="flex-between">
                  <div>
                    <div className="p-16-medium">{u.firstName || u.username || u.email}</div>
                    <div className="p-14-medium text-dark-400">{u.email} · {u.clerkId}</div>
                  </div>
                  <div className="p-16-medium">Credits: {balance}</div>
                </div>

                {org && (
                  <form action={async (formData) => {
                    "use server";
                    const delta = Number(formData.get("delta"));
                    if (!Number.isFinite(delta) || delta === 0) return;
                    await updateCredits(org.id, delta, delta > 0 ? "admin grant" : "admin deduction");
                  }} className="flex gap-3">
                    <input className="input-field" type="number" step="1" name="delta" placeholder="(+/-) credits" />
                    <button className="btn" type="submit">Apply</button>
                  </form>
                )}
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



