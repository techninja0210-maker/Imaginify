import Header from '@/components/shared/Header'
import TransformationForm from '@/components/shared/TransformationForm';
import { transformationTypes } from '@/constants'
import { getUserById } from '@/lib/actions/user.actions';
import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

const AddTransformationTypePage = async ({ params: { type } }: SearchParamProps) => {
  const { userId } = auth();
  const transformation = transformationTypes[type];

  if(!userId) redirect('/sign-in')

  const user = await getUserById(userId);

  const organizationId =
    user?.organizationMembers?.[0]?.organizationId ||
    user?.organizationMembers?.[0]?.organization?.id;

  // Use user's credit balance (user-scoped) as the source of truth
  const creditBalance = user?.creditBalance || 0;

  return (
    <>
      <Header 
        title={transformation.title}
        subtitle={transformation.subTitle}
      />
    
      <section className="mt-10">
        <TransformationForm 
          action="Add"
          userId={user.id}
          organizationId={organizationId}
          type={transformation.type as TransformationTypeKey}
          creditBalance={creditBalance}
        />
      </section>
    </>
  )
}

export default AddTransformationTypePage