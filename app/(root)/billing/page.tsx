import { Button } from "@/components/ui/button";
import { openCustomerPortalWithReturnUrl, ensureStripeCustomerForCurrentUser, changeSubscription } from "@/lib/actions/subscription.actions";
import { prisma } from "@/lib/database/prisma";
import { getUserById } from "@/lib/actions/user.actions";
import { auth } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";
import Stripe from "stripe";
import Link from "next/link";
import { CreditCard, Calendar, Coins, TrendingUp, Settings, ShoppingBag, FileText, Download, ArrowUp, ArrowDown } from "lucide-react";

// Force dynamic rendering to ensure fresh credit data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // Fetch invoices
  let invoices: Stripe.Invoice[] = [];
  let currentPriceId: string | null = null;
  if (customerId && stripe) {
    try {
      const invoicesList = await stripe.invoices.list({
        customer: customerId,
        limit: 20,
      });
      invoices = invoicesList.data;

      // Get current subscription price ID
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      if (subs.data.length > 0) {
        const item = subs.data[0].items.data[0];
        currentPriceId = item?.price?.id || null;
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  }

  // Available plans
  const plans = [
    {
      name: "Starter",
      price: "$10",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
      credits: 100,
    },
    {
      name: "Pro",
      price: "$30",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
      credits: 500,
    },
    {
      name: "Business",
      price: "$60",
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE,
      credits: 1000,
    },
  ];

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
                    await openCustomerPortalWithReturnUrl(customerId, `${process.env.NEXT_PUBLIC_SERVER_URL || 'https://shoppablevideos.com'}/billing`);
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

        {/* Change Plan Section */}
        {customerId && currentPriceId && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Change Plan</h2>
              <p className="text-sm text-gray-500 mt-1">Upgrade or downgrade your subscription</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  if (!plan.priceId) return null;
                  const isCurrentPlan = plan.priceId === currentPriceId;
                  // Determine if this is an upgrade or downgrade based on plan order
                  const planOrder = ["Starter", "Pro", "Business"];
                  const currentPlanIndex = plans.findIndex(p => p.priceId === currentPriceId);
                  const thisPlanIndex = planOrder.indexOf(plan.name);
                  const isUpgrade = !isCurrentPlan && thisPlanIndex > currentPlanIndex;
                  const isDowngrade = !isCurrentPlan && thisPlanIndex < currentPlanIndex;

                  return (
                    <div
                      key={plan.name}
                      className={`p-4 rounded-lg border-2 ${
                        isCurrentPlan
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{plan.price}</p>
                        <p className="text-xs text-gray-500 mt-1">{plan.credits} credits/month</p>
                      </div>
                      {isCurrentPlan ? (
                        <Button disabled className="w-full" variant="outline">
                          Current Plan
                        </Button>
                      ) : (
                        <form action={async () => {
                          "use server";
                          await changeSubscription(plan.priceId!);
                        }}>
                          <Button
                            type="submit"
                            variant={isUpgrade ? "default" : "outline"}
                            className={`w-full ${
                              isUpgrade
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "border-gray-300 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {isUpgrade ? (
                              <>
                                <ArrowUp className="w-4 h-4 mr-2" />
                                Upgrade
                              </>
                            ) : (
                              <>
                                <ArrowDown className="w-4 h-4 mr-2" />
                                Downgrade
                              </>
                            )}
                          </Button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
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

        {/* Invoices Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
            </div>
          </div>
          <div className="p-6">
            {!customerId ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-500 font-medium">No billing account linked</p>
                <p className="text-xs text-gray-400 mt-1">Link your billing account to view invoices</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-500 font-medium">No invoices yet</p>
                <p className="text-xs text-gray-400 mt-1">Your invoices will appear here once you make a purchase</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => {
                  const date = new Date(invoice.created * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const amount = invoice.amount_paid ? (invoice.amount_paid / 100).toFixed(2) : '0.00';
                  const status = invoice.status === 'paid' ? 'Paid' : invoice.status === 'open' ? 'Open' : invoice.status === 'void' ? 'Void' : 'Draft';
                  const statusColor = invoice.status === 'paid' ? 'bg-green-100 text-green-700' : invoice.status === 'open' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700';
                  const invoiceUrl = invoice.hosted_invoice_url || invoice.invoice_pdf;

                  return (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {invoice.number || invoice.id}
                            </p>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                              {status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {date} • ${amount}
                          </p>
                          {invoice.description && (
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              {invoice.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {invoiceUrl && (
                          <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {invoice.hosted_invoice_url ? 'View' : 'Download'}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingPage;
