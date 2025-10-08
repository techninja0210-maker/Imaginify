import Header from "@/components/shared/Header";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/actions/user.actions";

const DashboardPage = async () => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);

  const credits = user?.organizationMembers?.[0]?.organization?.credits?.balance || 0;

  return (
    <>
      <Header title="Dashboard" subtitle="Credits, usage and billing overview" />
      <section className="mt-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="profile-balance">
            <p className="p-14-medium md:p-16-medium">CREDITS AVAILABLE</p>
            <h2 className="h2-bold text-dark-600 mt-2">{credits}</h2>
          </div>
          <a href="/billing" className="collection-card p-6">Manage Subscription</a>
          <a href="/credits" className="collection-card p-6">Buy Top-up</a>
        </div>
      </section>
    </>
  );
};

export default DashboardPage;



