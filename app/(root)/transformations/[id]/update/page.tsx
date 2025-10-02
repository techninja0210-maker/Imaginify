import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import Header from "@/components/shared/Header";
import TransformationForm from "@/components/shared/TransformationForm";
import { transformationTypes } from "@/constants";
import { getUserById } from "@/lib/actions/user.actions";
import { getJobById } from "@/lib/actions/job.actions";

const Page = async ({ params: { id } }: SearchParamProps) => {
  const { userId } = auth();

  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  const job = await getJobById(id);

  const transformation =
    transformationTypes[job.workflowType as TransformationTypeKey];

  return (
    <>
      <Header title={transformation.title} subtitle={transformation.subTitle} />

      <section className="mt-10">
        <TransformationForm
          action="Update"
          userId={user.id}
          type={job.workflowType as TransformationTypeKey}
          creditBalance={user.organizationMembers?.[0]?.organization?.credits?.[0]?.balance || 0}
          config={job.metadata}
          data={job}
        />
      </section>
    </>
  );
};

export default Page;