import { Collection } from "@/components/shared/Collection"
import { navLinks } from "@/constants"
import { getAllJobs } from "@/lib/actions/job.actions"
import { getUserById } from "@/lib/actions/user.actions"
import { auth } from "@clerk/nextjs"
import Image from "next/image"
import Link from "next/link"
import { prisma } from "@/lib/database/prisma"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

const Home = async ({ searchParams }: SearchParamProps) => {
  const { userId } = auth();
  const page = Number(searchParams?.page) || 1;
  const searchQuery = (searchParams?.query as string) || '';

  const jobs = await getAllJobs({ page, searchQuery})
  
  // Get user data if logged in
  const user = userId ? await getUserById(userId) : null;
  const credits = user?.creditBalance || 0;

  // Get subscription and billing info
  let currentPlan = "Free";
  let renewsOn = null;
  let autoTopUpInfo = null;

  if (user?.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (customer && !customer.deleted) {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0];
          const item = sub.items.data[0];
          const price: any = item?.price;
          const product: any = price?.product;
          // Convert Stripe Price ID to user-friendly plan name
          const priceId = price?.id;
          if (priceId) {
            // Handle specific known price IDs
            if (priceId === 'price_1SClT9Ga7aLeMOtbwOMdnuUN') {
              currentPlan = "Pro Plan"; // Based on your subscription
            } else if (priceId.includes('starter') || priceId.includes('basic')) {
              currentPlan = "Starter Plan";
            } else if (priceId.includes('pro')) {
              currentPlan = "Pro Plan";
            } else if (priceId.includes('scale') || priceId.includes('enterprise')) {
              currentPlan = "Scale Plan";
            } else {
              currentPlan = price?.nickname || product?.name || "Active Plan";
            }
          } else {
            currentPlan = price?.nickname || product?.name || "Active Subscription";
          }
          if (sub.current_period_end) {
            renewsOn = new Date(sub.current_period_end * 1000).toLocaleDateString();
          }
        }
      }
    } catch (error) {
      console.error("Error fetching subscription info:", error);
    }
  }

  // Get auto top-up info
  const orgId = user?.organizationMembers?.[0]?.organization?.id as string | undefined;
  if (orgId) {
    try {
      autoTopUpInfo = await prisma.creditBalance.findUnique({ 
        where: { organizationId: orgId } 
      });
    } catch (error) {
      console.error("Error fetching auto top-up info:", error);
    }
  }

  return (
    <>
      {userId ? (
        // Dashboard view for logged-in users
        <section className="home">
          <div className="w-full rounded-2xl bg-purple-gradient p-8 md:p-12 text-white relative overflow-hidden">
            <h1 className="home-heading text-white">Welcome to Your Video Studio</h1>
            <p className="p-16-regular mt-2 opacity-90">Start a workflow directly from here.</p>

            {/* Account Information Panel - Embedded in Banner */}
            <div className="absolute right-6 top-6">
              <div className="bg-gray-800/90 backdrop-blur-md rounded-xl p-4 border-2 border-white/30 shadow-xl w-64">
                <div className="space-y-3">
                  {/* Credits */}
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">💰</span>
                    </div>
                    <span className="text-white font-semibold">Credits: {typeof credits === 'number' ? credits : '—'}</span>
                  </div>
                  
                  {/* Plan */}
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">🏆</span>
                    </div>
                    <div className="bg-green-500 rounded-full px-3 py-1">
                      <span className="text-white text-sm font-semibold">Plan: {currentPlan}</span>
                    </div>
                  </div>
                  
                  {/* Renews */}
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">📅</span>
                    </div>
                    <span className="text-white font-semibold">Renews: {renewsOn || "N/A"}</span>
                  </div>
                  
                  {/* Auto top-up */}
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">🔒</span>
                    </div>
                    <div className="bg-orange-500 rounded-full px-3 py-1">
                      <span className="text-white text-sm font-semibold">Auto top-up: Disabled</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Workflow Options - Compact Icons Above Text */}
            <div className="mt-8 flex justify-center gap-8">
              <Link href="/transformations/add/restore" className="flex flex-col items-center gap-2 text-white hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Image src="/assets/icons/image.svg" alt="restore" width={24} height={24} className="filter brightness-0 invert" />
                </div>
                <span className="text-sm font-medium">Image Restore</span>
              </Link>
              
              <Link href="/transformations/add/fill" className="flex flex-col items-center gap-2 text-white hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Image src="/assets/icons/stars.svg" alt="fill" width={24} height={24} className="filter brightness-0 invert" />
                </div>
                <span className="text-sm font-medium">Generative Fill</span>
              </Link>
              
              <Link href="/transformations/add/remove" className="flex flex-col items-center gap-2 text-white hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Image src="/assets/icons/scan.svg" alt="remove" width={24} height={24} className="filter brightness-0 invert" />
                </div>
                <span className="text-sm font-medium">Object Remove</span>
              </Link>
              
              <Link href="/transformations/add/recolor" className="flex flex-col items-center gap-2 text-white hover:opacity-80 transition-opacity">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Image src="/assets/icons/filter.svg" alt="recolor" width={24} height={24} className="filter brightness-0 invert" />
                </div>
                <span className="text-sm font-medium">Object Recolor</span>
              </Link>
            </div>

          </div>
        </section>
      ) : (
        // Marketing view for visitors
      <section className="home">
        <h1 className="home-heading">
          Unleash Your Creative Vision with Imaginify
        </h1>
        <div className="mt-6 flex justify-center">
          <Link href="/pricing" className="button bg-purple-gradient bg-cover rounded-full px-6 py-3 text-white">
            See Pricing
          </Link>
        </div>
      </section>
      )}

      <section className="mt-6">
        { (jobs as any)?.dbDown && (
          <div className="mb-4 rounded-md bg-amber-50 p-4 text-amber-800">
            Database is temporarily unavailable. Showing a limited view. <a href="/api/health/db" className="underline">Retry</a>
          </div>
        )}
        <ul className="flex-center w-full gap-20">
          {navLinks.slice(1, 5).map((link) => (
            <Link
              key={link.route}
              href={link.route}
              className="flex-center flex-col gap-2"
            >
              <li className="flex-center w-fit rounded-full bg-white p-4">
                <Image src={link.icon} alt="image" width={24} height={24} />
              </li>
              <p className="p-14-medium text-center text-dark-700">{link.label}</p>
            </Link>
          ))}
        </ul>
      </section>

      <section className="sm:mt-12">
        <Collection 
          hasSearch={true}
          images={jobs?.data}
          totalPages={jobs?.totalPage}
          page={page}
        />
      </section>
    </>
  )
}

export default Home