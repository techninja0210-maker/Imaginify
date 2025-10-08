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
  const autoTopUpInfo: any = orgId ? await prisma.creditBalance.findUnique({ where: { organizationId: orgId } }) : null;
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
        expand: ["data.items.data.price.product"],
      });
      const sub = subs.data[0];
      if (sub) {
        const item = sub.items.data[0];
        const price: any = item?.price;
        const product: any = price?.product;
        currentPlan = price?.nickname || product?.name || price?.id || "Active Subscription";
        if (sub.current_period_end) {
          renewsOn = new Date(sub.current_period_end * 1000).toLocaleDateString();
        }
      }
    } catch {
      // If subscription retrieval fails unexpectedly, fallback to not-found
      notFound();
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
          <div className="p-16-regular">Credits: <span className="text-purple-500">{user?.organizationMembers?.[0]?.organization?.credits?.balance || 0}</span></div>
          <div className="p-16-regular">Auto top-up: <span className="text-purple-500">{autoTopUpInfo?.autoTopUpEnabled ? `Enabled (${autoTopUpInfo?.autoTopUpAmountCredits ?? 0} credits at threshold ${autoTopUpInfo?.lowBalanceThreshold ?? 0})` : 'Disabled'}</span></div>
        </div>

        {/* Direct link to Stripe Billing Portal (provided URL) */}
        <a href="https://billing.stripe.com/p/login/test_6oUaEX1FCbFC5AG8sY5Vu00" target="_blank" rel="noopener noreferrer" className="w-full">
          <Button type="button" className="w-full rounded-full bg-purple-gradient bg-cover">Manage Subscription in Stripe</Button>
        </a>

        <form action={async () => {
          "use server";
          if (!customerId) return;
          await openCustomerPortalWithReturnUrl(customerId, "https://www.shoppablevideos.com/");
        }}>
          <Button
            type="submit"
            className="w-full rounded-full bg-purple-gradient bg-cover"
            disabled={!customerId}
          >
            {customerId ? "Open Customer Portal (return to site)" : "Customer Portal (coming soon)"}
          </Button>
        </form>
      </section>
    </>
  );
};

export default BillingPage;



