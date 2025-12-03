import { Collection } from "@/components/shared/Collection"
import { navLinks } from "@/constants"
import { getAllJobs } from "@/lib/actions/job.actions"
import { getUserById } from "@/lib/actions/user.actions"
import { auth } from "@clerk/nextjs"
import Image from "next/image"
import Link from "next/link"
import { prisma } from "@/lib/database/prisma"
import Stripe from "stripe"
import dynamicImport from "next/dynamic"
// Removed updateCredits import - webhook handles credit grants with new grant system
import { revalidatePath } from "next/cache"

// Dynamically import client components - must be client-side only
const AutoGrantCredits = dynamicImport(() => import("@/components/shared/AutoGrantCredits").then(mod => ({ default: mod.AutoGrantCredits })), { 
  ssr: false,
  loading: () => null
})

const ManualCreditGrant = dynamicImport(() => import("@/components/shared/ManualCreditGrant").then(mod => ({ default: mod.ManualCreditGrant })), { 
  ssr: false,
  loading: () => null
})

const LandingPage = dynamicImport(() => import("./LandingPage").then(mod => ({ default: mod.default })), { 
  ssr: false
})

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

// Force dynamic rendering to prevent caching and ensure fresh credit data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Home = async ({ 
  searchParams 
}: { 
  searchParams: { [key: string]: string | string[] | undefined } 
}) => {
  const { userId } = auth();
  const page = Number(searchParams?.page) || 1;
  const searchQuery = (searchParams?.query as string) || '';

  // Auto-grant credits if returning from successful Stripe checkout
  // Log all searchParams to debug
  console.log(`[HOME PAGE] All searchParams:`, JSON.stringify(searchParams));
  console.log(`[HOME PAGE] searchParams type:`, typeof searchParams);
  console.log(`[HOME PAGE] searchParams keys:`, Object.keys(searchParams || {}));
  
  // Handle both string and string[] types from Next.js searchParams
  const sessionIdRaw = searchParams?.session_id;
  const successParamRaw = searchParams?.success;
  
  const sessionId = Array.isArray(sessionIdRaw) ? sessionIdRaw[0] : sessionIdRaw as string | undefined;
  const successParam = Array.isArray(successParamRaw) ? successParamRaw[0] : successParamRaw as string | undefined;
  
  const success = successParam === '1' || successParam === 'true';
  let creditsGranted = 0;
  let showSuccessMessage = false;
  
  console.log(`[HOME PAGE] Check auto-grant: userId=${userId}, success=${success} (param="${successParam}"), sessionId=${sessionId}, hasStripeKey=${!!process.env.STRIPE_SECRET_KEY}`);
  
  if (userId && success && sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      console.log(`[HOME PAGE] Attempting to auto-grant credits for session: ${sessionId}`);
      
      // Check if already processed
      const idemKey = `stripe:session:${sessionId}`;
      const existingLedger = await prisma.creditLedger.findUnique({
        where: { idempotencyKey: idemKey }
      });

      if (existingLedger) {
        // Already processed - show message
        creditsGranted = existingLedger.amount;
        showSuccessMessage = true;
        console.log(`[HOME PAGE] Credits already granted for session ${sessionId}: ${creditsGranted} credits`);
      } else {
        // Get Stripe session
        console.log(`[HOME PAGE] Fetching Stripe session: ${sessionId}`);
        const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
        console.log(`[HOME PAGE] Stripe session payment_status: ${stripeSession.payment_status}`);
        
        if (stripeSession.payment_status === 'paid') {
          const metadata: any = stripeSession.metadata || {};
          const buyerId = metadata.clerkUserId || metadata.buyerId;
          const credits = Number(metadata.credits || 0);
          
          console.log(`[HOME PAGE] Session metadata - buyerId: ${buyerId}, credits: ${credits}, currentUserId: ${userId}`);

          // Verify this is the current user's session
          if (buyerId === userId && credits > 0) {
            // Verify user exists before granting
            const userExists = await prisma.user.findUnique({
              where: { clerkId: userId },
              select: { id: true, creditBalance: true }
            });

            if (userExists) {
              console.log(`[HOME PAGE] User found, current balance: ${userExists.creditBalance}, granting ${credits} credits`);
              
              try {
                // Use the new credit grant system instead of updateCredits for top-ups
                // The webhook handler will handle this properly with grant system
                // For now, just log and let webhook handle it to avoid duplicate grants
                console.log(`[HOME PAGE] ⚠️ Skipping direct credit grant - webhook will handle with grant system`);
                // The webhook at /api/webhooks/stripe will handle credit grants properly
                // using the new grant system with expiry tracking
              } catch (grantError: any) {
                console.error(`[HOME PAGE] ❌ Failed to grant credits:`, grantError?.message || grantError);
                // Continue - client-side component or webhook will handle it
              }
            } else {
              console.error(`[HOME PAGE] ❌ User not found: ${userId}`);
            }
          } else {
            console.warn(`[HOME PAGE] ⚠️ Session buyerId (${buyerId}) doesn't match current user (${userId}) or credits <= 0`);
          }
        } else {
          console.warn(`[HOME PAGE] ⚠️ Session not paid: ${stripeSession.payment_status}`);
        }
      }
    } catch (error: any) {
      console.error('[HOME PAGE] ❌ Failed to auto-grant credits:', error?.message || error);
      // Continue - webhook or manual grant will handle it
    }
  } else {
    console.log(`[HOME PAGE] Skipping auto-grant: userId=${!!userId}, success=${success}, sessionId=${!!sessionId}, hasStripeKey=${!!process.env.STRIPE_SECRET_KEY}`);
  }

  const jobs = await getAllJobs({ page, searchQuery})
  
  // Get user data if logged in (refresh to get updated balance - force fresh fetch)
  const user = userId ? await getUserById(userId) : null;
  
  // Get effective credit balance (from active grants) if user exists
  let credits = user?.creditBalance || 0;
  if (user?.id) {
    try {
      const { getActiveCreditGrants } = await import('@/lib/services/credit-grants');
      const grantSummary = await getActiveCreditGrants(user.id);
      // Use total available from grants if it's higher than creditBalance (more accurate)
      // creditBalance should match, but grants are the source of truth
      if (grantSummary.totalAvailable > 0) {
        credits = grantSummary.totalAvailable;
      }
    } catch (error) {
      // Fallback to creditBalance if grants calculation fails
      console.error('[HOME PAGE] Failed to calculate effective balance:', error);
    }
  }
  
  // Log current balance for debugging
  if (userId && success && sessionId) {
    console.log(`[HOME PAGE] Current user balance: ${credits}, creditsGranted: ${creditsGranted}`);
  }

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
          const priceId = price?.id;
          if (priceId) {
            if (priceId === 'price_1SClT9Ga7aLeMOtbwOMdnuUN') {
              currentPlan = "Pro Plan";
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

  const workflowLinks = [
    { href: "/transformations/add/restore", icon: "/assets/icons/image.svg", label: "Image Restore", color: "blue" },
    { href: "/transformations/add/fill", icon: "/assets/icons/stars.svg", label: "Generative Fill", color: "purple" },
    { href: "/transformations/add/remove", icon: "/assets/icons/scan.svg", label: "Object Remove", color: "green" },
    { href: "/transformations/add/recolor", icon: "/assets/icons/filter.svg", label: "Object Recolor", color: "orange" },
  ];

  return (
    <div className="bg-gray-50">
      {/* Auto-grant credits component - ensures credits are granted when returning from Stripe */}
      {/* This component MUST run on client side to detect URL parameters */}
      <AutoGrantCredits />
      {/* Manual grant button - fallback if automatic grant doesn't work */}
      <ManualCreditGrant />
      {userId ? (
        // Dashboard view for logged-in users
        <div className="space-y-8 pb-8">
          {/* Success Message */}
          {showSuccessMessage && creditsGranted > 0 && (
            <div className="max-w-7xl mx-auto px-8 md:px-12 pt-8">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl">✓</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-green-900">Credits Added Successfully!</h3>
                    <p className="text-sm text-green-700 mt-1">
                      {creditsGranted.toLocaleString()} credits have been added to your account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 shadow-xl">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
            <div className="relative px-8 py-12 md:px-12 md:py-16">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                  {/* Main Content */}
                  <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
                      Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
                    </h1>
                    <p className="text-xl text-purple-100 mb-8">
                      Transform your images with AI-powered tools
                    </p>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {workflowLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="group relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-200 hover:scale-105 hover:shadow-lg"
                        >
                          <div className="flex flex-col items-center gap-3">
                            <div className={`w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors`}>
                              <Image 
                                src={link.icon} 
                                alt={link.label} 
                                width={24} 
                                height={24} 
                                className="filter brightness-0 invert"
                              />
                            </div>
                            <span className="text-sm font-medium text-white text-center">
                              {link.label}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Account Info Card */}
                  <div className="lg:w-80">
                    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                        Account Overview
                      </h3>
                      
                      <div className="space-y-4">
                        {/* Credits */}
                        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-sm">
                              <span className="text-xl">💰</span>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Total Credits</p>
                              <p className="text-2xl font-bold text-gray-900">{credits.toLocaleString()}</p>
                              <Link href="/credits" className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-block">
                                View breakdown →
                              </Link>
                            </div>
                          </div>
                        </div>

                        {/* Plan */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center shadow-sm">
                              <span className="text-xl">🏆</span>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-medium">Plan</p>
                              <p className="text-sm font-semibold text-gray-900">{currentPlan}</p>
                            </div>
                          </div>
                        </div>

                        {/* Renewal Date */}
                        {renewsOn && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center shadow-sm">
                                <span className="text-xl">📅</span>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">Renews</p>
                                <p className="text-sm font-semibold text-gray-900">{renewsOn}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Auto Top-up */}
                        <div className="pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">Auto Top-up</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              autoTopUpInfo?.autoTopUpEnabled 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {autoTopUpInfo?.autoTopUpEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 space-y-2">
                          <Link
                            href="/credits"
                            className="block w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors text-center shadow-sm"
                          >
                            Buy Credits
                          </Link>
                          <Link
                            href="/billing"
                            className="block w-full px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors text-center"
                          >
                            Manage Subscription
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Jobs Section */}
          <div className="max-w-7xl mx-auto px-8 md:px-12">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Recent Edits</h2>
                    <p className="text-sm text-gray-500 mt-1">Your latest transformations</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {(jobs as any)?.dbDown && (
                  <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <p className="text-sm text-amber-800">
                      Database is temporarily unavailable. Showing a limited view.{' '}
                      <a href="/api/health/db" className="font-medium underline">Retry</a>
                    </p>
                  </div>
                )}
                
                <Collection 
                  hasSearch={true}
                  images={jobs?.data}
                  totalPages={jobs?.totalPage}
                  page={page}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Minimal landing page with centered logo
        <LandingPage />
      )}
    </div>
  )
}

export default Home
