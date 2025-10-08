import { Collection } from "@/components/shared/Collection"
import { navLinks } from "@/constants"
import { getAllJobs } from "@/lib/actions/job.actions"
import { getUserById } from "@/lib/actions/user.actions"
import { auth } from "@clerk/nextjs"
import Image from "next/image"
import Link from "next/link"

const Home = async ({ searchParams }: SearchParamProps) => {
  const { userId } = auth();
  const page = Number(searchParams?.page) || 1;
  const searchQuery = (searchParams?.query as string) || '';

  const jobs = await getAllJobs({ page, searchQuery})
  
  // Get user data if logged in
  const user = userId ? await getUserById(userId) : null;
  const credits = user?.organizationMembers?.[0]?.organization?.credits?.balance || 0;

  return (
    <>
      {userId ? (
        // Dashboard view for logged-in users
        <section className="home">
          <div className="w-full rounded-2xl bg-purple-gradient p-8 md:p-12 text-white relative overflow-hidden">
            <h1 className="home-heading text-white">Welcome to Your Video Studio</h1>
            <p className="p-16-regular mt-2 opacity-90">Start a workflow directly from here.</p>

            {/* Credits pill */}
            <div className="absolute right-6 top-6 rounded-full bg-white/90 px-4 py-2 text-dark-600 shadow-sm backdrop-blur-md">
              <span className="p-14-medium">Credits:</span>
              <span className="p-16-medium ml-2">{typeof credits === 'number' ? credits : '—'}</span>
            </div>

            {/* Primary CTA buttons inside hero */}
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <Link href="/transformations/add/restore" className="rounded-xl bg-white/95 p-5 text-dark-700 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
                <Image src="/assets/icons/image.svg" alt="restore" width={24} height={24} />
                <span className="p-16-medium">Image Restore</span>
              </Link>
              <Link href="/transformations/add/fill" className="rounded-xl bg-white/95 p-5 text-dark-700 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
                <Image src="/assets/icons/stars.svg" alt="fill" width={24} height={24} />
                <span className="p-16-medium">Generative Fill</span>
              </Link>
              <Link href="/transformations/add/remove" className="rounded-xl bg-white/95 p-5 text-dark-700 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
                <Image src="/assets/icons/scan.svg" alt="remove" width={24} height={24} />
                <span className="p-16-medium">Object Remove</span>
              </Link>
              <Link href="/transformations/add/recolor" className="rounded-xl bg-white/95 p-5 text-dark-700 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
                <Image src="/assets/icons/filter.svg" alt="recolor" width={24} height={24} />
                <span className="p-16-medium">Object Recolor</span>
              </Link>
            </div>

            {/* Secondary actions */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Link href="/billing" className="rounded-xl bg-white/20 p-5 text-white shadow-sm hover:bg-white/25 transition-colors text-center">
                Manage Subscription
              </Link>
              <Link href="/credits" className="rounded-xl bg-white/20 p-5 text-white shadow-sm hover:bg-white/25 transition-colors text-center">
                Buy Top-up
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