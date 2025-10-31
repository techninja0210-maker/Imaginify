import { auth } from "@clerk/nextjs";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Collection } from "@/components/shared/Collection";
import { prisma } from "@/lib/database/prisma";
import Header from "@/components/shared/Header";
import { getUserJobs } from "@/lib/actions/job.actions";
import { getUserById } from "@/lib/actions/user.actions";

const Profile = async ({ searchParams }: SearchParamProps) => {
  const page = Number(searchParams?.page) || 1;
  const { userId } = auth();

  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  const jobs = await getUserJobs({ page, userId: user.id });

  const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;
  const ledger = orgId ? await prisma.creditLedger.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 10 }) : [];

  return (
    <>
      <Header title="Profile" />

      <section className="profile">
        <div className="profile-balance">
          <p className="p-14-medium md:p-16-medium">CREDITS AVAILABLE</p>
          <div className="mt-4 flex items-center gap-4">
            <Image
              src="/assets/icons/coins.svg"
              alt="coins"
              width={50}
              height={50}
              className="size-9 md:size-12"
            />
            <div>
              <h2 className="h2-bold text-dark-600">{user.creditBalance || 0}</h2>
              <div className="mt-2 text-sm text-gray-500">
                <p>User Balance: <span className="font-semibold">{user.creditBalance || 0}</span></p>
                <p>Org Balance: <span className="font-semibold">{user.organizationMembers?.[0]?.organization?.credits?.balance || 'N/A'}</span></p>
                {user.creditBalance !== (user.organizationMembers?.[0]?.organization?.credits?.balance || 0) && (
                  <p className="text-yellow-600 text-xs mt-1">⚠️ Out of sync</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="profile-image-manipulation w-full">
          <p className="p-14-medium md:p-16-medium">RECENT CREDIT ACTIVITY</p>
          <ul className="mt-4 space-y-2">
            {ledger.map((e: any) => (
              <li key={e.id} className="flex-between collection-card p-3">
                <span className="p-14-medium">{e.type} ({e.reason})</span>
                <span className={`p-14-medium ${e.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>{e.amount}</span>
              </li>
            ))}
            {!ledger.length && <li className="p-14-medium text-dark-400">No recent activity</li>}
          </ul>
        </div>
      </section>

      <section className="mt-8 md:mt-14">
        <Collection
          images={jobs?.data}
          totalPages={jobs?.totalPages}
          page={page}
        />
      </section>
    </>
  );
};

export default Profile;