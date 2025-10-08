import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// Helper: resolve a Stripe Price by credits via Price metadata (credits=<int>)
async function findPriceIdByCredits(stripe: Stripe, credits: number): Promise<string | null> {
  const prices = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 100 });
  for (const p of prices.data) {
    const c = Number((p.metadata as any)?.credits || 0);
    if (c === credits) return p.id;
  }
  return null;
}

export async function POST(request: Request) {
  // Optional protection: require CRON_SECRET if provided
  const requiredSecret = process.env.CRON_SECRET;
  if (requiredSecret) {
    const header = request.headers.get("x-cron-secret");
    if (header !== requiredSecret) return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // 1) Find candidate balances and filter in JS to avoid Prisma type/version issues on deploy
  const candidates: any[] = await prisma.creditBalance.findMany({
    include: { organization: { include: { members: { include: { user: true } } } } },
    take: 200,
  }) as any;
  const lowBalances = candidates.filter((cb: any) => cb?.autoTopUpEnabled && typeof cb?.balance === 'number' && typeof cb?.lowBalanceThreshold === 'number' && cb.balance < cb.lowBalanceThreshold).slice(0, 50);

  const results: any[] = [];

  for (const cb of lowBalances) {
    try {
      const creditsToBuy = cb.autoTopUpAmountCredits || 0;
      if (!creditsToBuy) continue;

      // 2) Resolve a paying user in the org with a Stripe customer
      const payingUser = cb.organization.members.find((m: any) => !!m.user?.stripeCustomerId)?.user;
      if (!payingUser?.stripeCustomerId) {
        results.push({ organizationId: cb.organizationId, skipped: true, reason: "No stripeCustomerId on any member" });
        continue;
      }

      // 3) Resolve price by metadata credits
      const priceId = await findPriceIdByCredits(stripe, creditsToBuy);
      if (!priceId) {
        results.push({ organizationId: cb.organizationId, skipped: true, reason: `No Stripe Price with credits=${creditsToBuy}` });
        continue;
      }

      // 4) Create an invoice item and finalize invoice for auto-charge
      const metadata: Record<string, string> = {
        clerkUserId: payingUser.clerkId,
        planCredits: String(creditsToBuy),
        purpose: "auto_top_up",
      };

      await stripe.invoiceItems.create({
        customer: payingUser.stripeCustomerId,
        price: priceId,
        metadata,
      });

      const invoice = await stripe.invoices.create({
        customer: payingUser.stripeCustomerId,
        collection_method: "charge_automatically",
        metadata,
        auto_advance: true,
      });

      // Attempt to pay immediately
      await stripe.invoices.finalizeInvoice(invoice.id);
      const paid = await stripe.invoices.pay(invoice.id, { paid_out_of_band: false });

      results.push({ organizationId: cb.organizationId, invoiceId: invoice.id, status: paid.status });
    } catch (e: any) {
      results.push({ organizationId: cb.organizationId, error: e?.message || "error" });
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results });
}



