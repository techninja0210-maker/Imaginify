import { Button } from "@/components/ui/button";
import { openCustomerPortalWithReturnUrl, ensureStripeCustomerForCurrentUser } from "@/lib/actions/subscription.actions";
import { prisma } from "@/lib/database/prisma";
import { getUserById } from "@/lib/actions/user.actions";
import { auth } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";
import Stripe from "stripe";
import Link from "next/link";
import { CreditCard, Calendar, Coins, TrendingUp, Settings, ShoppingBag } from "lucide-react";

const BillingPage = async () => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  if (!user) notFound();
  let customerId = user.stripeCustomerId ?? null;

  // Fetch active subscription (if any)
  let currentPlan: string | null = null;
  let renewsOn: string | null = null;
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null as any;

  // Fallback: if no saved customerId, try to resolve by email
  if (!customerId && stripe) {
    try {
      if (user.email) {
        const search = await (stripe as any).customers.search?.({ query: `email:'${user.email}'` }).catch(() => null);
        const found = (search?.data?.[0]) || (await stripe.customers.list({ email: user.email, limit: 1 })).data[0];
        if (found?.id) {
          customerId = found.id;
          await prisma.user.update({ where: { clerkId: user.clerkId }, data: { stripeCustomerId: customerId } });
        }
      }
    } catch {}
  }

  if (customerId && stripe) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      const sub = subs.data[0];
      if (sub) {
        const item = sub.items.data[0];
        const price: any = item?.price;
        
        let product: any = null;
        if (price?.product) {
          try {
            product = await stripe.products.retrieve(price.product);
          } catch (e) {}
        }
        
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
    } catch (error) {
      console.error('Stripe subscription retrieval failed:', error);
    }
  }

  // Auto top-up info
  const orgId = user?.organizationMembers?.[0]?.organization?.id as string | undefined;
  const autoTopUpInfo = orgId ? await prisma.creditBalance.findUnique({ where: { organizationId: orgId } }) : null;

  const userBalance = user?.creditBalance || 0;
  const orgBalance = autoTopUpInfo?.balance || 0;
  const isOutOfSync = userBalance !== orgBalance;
  const autoTopUpEnabled = !!autoTopUpInfo?.autoTopUpEnabled;
  const autoTopUpAmount = autoTopUpInfo?.autoTopUpAmountCredits ?? 0;
  const lowBalanceThreshold = autoTopUpInfo?.lowBalanceThreshold ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your subscription and invoices
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Subscription Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Current Plan */}
              <div>
                <p className="text-sm text-gray-500 font-medium mb-2">Current Plan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {currentPlan || (customerId ? "No active subscription" : "Not linked yet")}
                </p>
              </div>

              {/* Renewal Date */}
              {renewsOn && (
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Renews on</p>
                    <p className="text-base font-semibold text-gray-900">{renewsOn}</p>
                  </div>
                </div>
              )}

              {/* Auto Top-up Status */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Auto Top-up</p>
                      {autoTopUpEnabled && (
                        <p className="text-xs text-gray-600 mt-1">
                          {autoTopUpAmount} credits at {lowBalanceThreshold} threshold
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    autoTopUpEnabled 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {autoTopUpEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Manage Subscription Button */}
              <div className="pt-4 border-t border-gray-200">
                {customerId ? (
                  <form action={async () => {
                    "use server";
                    await openCustomerPortalWithReturnUrl(customerId, "https://www.shoppablevideos.com/");
                  }}>
                    <Button
                      type="submit"
                      className="w-full py-2.5 bg-purple-600 text-white hover:bg-purple-700 font-medium rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </Button>
                  </form>
                ) : (
                  <form action={async () => {
                    "use server";
                    const cid = await ensureStripeCustomerForCurrentUser();
                    await openCustomerPortalWithReturnUrl(cid, `${process.env.NEXT_PUBLIC_SERVER_URL}/billing`);
                  }}>
                    <Button 
                      type="submit" 
                      className="w-full py-2.5 bg-purple-600 text-white hover:bg-purple-700 font-medium rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Link Billing Account
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Credit Balance Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Credit Balance</h2>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Current Balance */}
              <div>
                <p className="text-sm text-gray-500 font-medium mb-2">Available Credits</p>
                <p className="text-4xl font-bold text-gray-900">{userBalance.toLocaleString()}</p>
              </div>

              {/* Balance Details */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">User Balance</span>
                  <span className="text-sm font-semibold text-gray-900">{userBalance.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Org Balance</span>
                  <span className="text-sm font-semibold text-gray-900">{orgBalance.toLocaleString()}</span>
                </div>
                {isOutOfSync && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800 font-medium flex items-center gap-2">
                      <span>⚠️</span>
                      <span>Balances are out of sync</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Buy Credits Button */}
              <div className="pt-4 border-t border-gray-200">
                <Link href="/credits" className="block">
                  <Button 
                    type="button" 
                    className="w-full py-2.5 bg-green-600 text-white hover:bg-green-700 font-medium rounded-lg transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Buy More Credits
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/credits">
                <Button 
                  variant="outline"
                  className="w-full py-3 border-2 border-green-600 text-green-600 hover:bg-green-50 font-medium rounded-lg transition-colors"
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Purchase Credits
                </Button>
              </Link>
              
              <Link href="/pricing">
                <Button 
                  variant="outline"
                  className="w-full py-3 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-medium rounded-lg transition-colors"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  View Plans
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
