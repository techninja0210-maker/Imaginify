import Header from "@/components/shared/Header";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const DashboardPage = async () => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  return (
    <>
      <Header title="Dashboard" subtitle="Your workspace for UGC video workflows" />
      <section className="mt-10">
        <div className="collection-empty">Dashboard content coming soon.</div>
      </section>
    </>
  );
};

export default DashboardPage;



