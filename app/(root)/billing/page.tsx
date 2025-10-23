import Header from "@/components/shared/Header";
import { Button } from "@/components/ui/button";
import { openCustomerPortal, openCustomerPortalWithReturnUrl } from "@/lib/actions/subscription.actions";
import { prisma } from "@/lib/database/prisma";
import { getUserById } from "@/lib/actions/user.actions";
import { auth } from "@clerk/nextjs";
import { notFound, redirect } from "next/navigation";
import Stripe from "stripe";

// Load Stripe customer ID from DB
async function getStripeCustomerIdForUser(userId: string): Promise<string | null> {
  const user = await getUserById(userId);
  const orgId = user?.organizationMembers?.[0]?.organization?.id as string | undefined;
  // Use a narrowed type that includes optional auto-top-up fields to satisfy build types
  type AutoInfo = {
    autoTopUpEnabled?: boolean;
    autoTopUpAmountCredits?: number | null;
    lowBalanceThreshold?: number;
  } | null;
  const autoTopUpInfo = (orgId ? await prisma.creditBalance.findUnique({ where: { organizationId: orgId } }) : null) as AutoInfo;
  const auto = autoTopUpInfo as any;
  return user?.stripeCustomerId ?? null;
}

const BillingPage = async () => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  // Load user and Stripe customer
  const user = await getUserById(userId);
  if (!user) notFound();
  const customerId = user.stripeCustomerId ?? null;

  // Fetch active subscription (if any)
  let currentPlan: string | null = null;
  let renewsOn: string | null = null;
  if (customerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      const sub = subs.data[0];
      if (sub) {
        const item = sub.items.data[0];
        const price: any = item?.price;
        
        // Get product details separately since we can't expand in list call
        let product: any = null;
        if (price?.product) {
          try {
            product = await stripe.products.retrieve(price.product);
          } catch (e) {
            // Product retrieval failed, continue without product info
          }
        }
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
    } catch (error) {
      // If subscription retrieval fails, log the error and continue without subscription data
      console.error('Stripe subscription retrieval failed:', error);
      // Don't call notFound() - just continue with null values
    }
  }

  // auto top-up info for display
  const orgId = user?.organizationMembers?.[0]?.organization?.id as string | undefined;
  const autoTopUpInfo = orgId ? await prisma.creditBalance.findUnique({ where: { organizationId: orgId } }) : null;

  return (
    <>
      <Header title="Billing" subtitle="Manage your subscription and invoices" />

      <section className="mt-10 space-y-6">
        <div className="grid gap-3">
          <div className="p-16-regular">Current plan: <span className="text-purple-500">{currentPlan ?? (customerId ? "No active subscription" : "Not linked yet")}</span></div>
          <div className="p-16-regular">Renews on: <span className="text-purple-500">{renewsOn ?? "—"}</span></div>
          <div className="p-16-regular">Credits: <span className="text-purple-500">{user?.creditBalance || 0}</span></div>
          {(() => {
            const info: any = autoTopUpInfo;
            const enabled = !!info?.autoTopUpEnabled;
            const amount = info?.autoTopUpAmountCredits ?? 0;
            const threshold = info?.lowBalanceThreshold ?? 0;
            return (
              <div className="p-16-regular">Auto top-up: <span className="text-purple-500">{enabled ? `Enabled (${amount} credits at threshold ${threshold})` : 'Disabled'}</span></div>
            );
          })()}
        </div>

        {/* Billing Actions */}
        <div className="space-y-4">
          {/* Buy More Credits */}
          <a href="/credits" className="w-full">
            <Button type="button" className="w-full rounded-full bg-green-600 hover:bg-green-700">
              💳 Buy More Credits
            </Button>
          </a>

          {/* Stripe Customer Portal */}
          {customerId ? (
            <form action={async () => {
              "use server";
              await openCustomerPortalWithReturnUrl(customerId, "https://www.shoppablevideos.com/");
            }}>
              <Button
                type="submit"
                className="w-full rounded-full bg-purple-gradient bg-cover"
              >
                🔧 Manage Subscription (Cancel/Upgrade)
              </Button>
            </form>
          ) : (
            <div className="text-center p-4 bg-gray-100 rounded-lg">
              <p className="text-gray-600">No active subscription</p>
              <a href="/credits" className="text-purple-600 hover:underline">
                Buy credits to get started
              </a>
            </div>
          )}

          {/* Direct Stripe Portal Link (for testing) */}
          <a 
            href="https://billing.stripe.com/p/login/test_6oUaEX1FCbFC5AG8sY5Vu00" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="w-full"
          >
            <Button type="button" className="w-full rounded-full bg-gray-600 hover:bg-gray-700">
              🔗 Direct Stripe Portal (Test)
            </Button>
          </a>
        </div>
      </section>
    </>
  );
};

export default BillingPage;



