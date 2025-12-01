import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { getUserById } from "@/lib/actions/user.actions";
import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/session
 * Get current user's session summary (plan, balance, renewal date, etc.)
 * 
 * Returns:
 * {
 *   user: { id, email, username, role },
 *   plan: { name, status, priceId, productId },
 *   subscription: { id, status, currentPeriodEnd, renewsOn, cancelAtPeriodEnd },
 *   balance: { userBalance, orgBalance, isOutOfSync },
 *   autoTopUp: { enabled, threshold, amount },
 *   lowBalance: { isLow, threshold }
 * }
 */
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get organization info
    const orgId = user.organizationMembers?.[0]?.organization?.id as string | undefined;
    const orgCredits = orgId
      ? await prisma.creditBalance.findUnique({
          where: { organizationId: orgId },
        })
      : null;

    // Get balances
    const userBalance = user.creditBalance || 0;
    const orgBalance = orgCredits?.balance || 0;
    const isOutOfSync = userBalance !== orgBalance;

    // Get low balance info
    const userThreshold = user.lowBalanceThreshold || 5;
    const orgThreshold = orgCredits?.lowBalanceThreshold || userThreshold;
    const threshold = Math.max(userThreshold, orgThreshold);
    const isLow = userBalance < threshold;

    // Get auto top-up settings
    const autoTopUp = {
      enabled: !!orgCredits?.autoTopUpEnabled,
      threshold: orgCredits?.lowBalanceThreshold || userThreshold,
      amount: orgCredits?.autoTopUpAmountCredits || null,
    };

    // Get pending plan info
    const userWithPendingPlan = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        pendingPlanId: true,
      }
    });

    const pendingPlan = userWithPendingPlan?.pendingPlanId
      ? await prisma.subscriptionPlan.findUnique({
          where: { id: userWithPendingPlan.pendingPlanId },
          select: {
            id: true,
            internalId: true,
            publicName: true,
            creditsPerCycle: true,
            priceUsd: true,
          }
        })
      : null;

    // Get Stripe subscription info
    let plan = null;
    let subscription = null;
    let customerId = user.stripeCustomerId;

    const stripe = process.env.STRIPE_SECRET_KEY
      ? new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: "2023-10-16",
        } as any)
      : null;

    // Fallback: try to find customer by email if no customerId
    if (!customerId && stripe && user.email) {
      try {
        const search = await (stripe as any).customers
          .search?.({ query: `email:'${user.email}'` })
          .catch(() => null);
        const found =
          search?.data?.[0] ||
          (await stripe.customers.list({ email: user.email, limit: 1 })).data[0];
        if (found?.id) {
          customerId = found.id;
        }
      } catch (error) {
        console.error("Error searching for Stripe customer:", error);
      }
    }

    // Fetch active subscription
    if (customerId && stripe) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all", // Get all subscriptions to check active ones
          limit: 10,
        });

        const activeSub = subs.data.find((sub) => sub.status === "active");
        if (activeSub) {
          const item = activeSub.items.data[0];
          const price: any = item?.price;

          let product: any = null;
          if (price?.product) {
            try {
              product =
                typeof price.product === "string"
                  ? await stripe.products.retrieve(price.product)
                  : price.product;
            } catch (e) {
              console.error("Error retrieving product:", e);
            }
          }

          // Determine plan name
          const priceId = price?.id;
          let planName = "Active Plan";
          if (priceId) {
            if (priceId === "price_1SClT9Ga7aLeMOtbwOMdnuUN") {
              planName = "Pro Plan";
            } else if (priceId.includes("starter") || priceId.includes("basic")) {
              planName = "Starter Plan";
            } else if (priceId.includes("pro")) {
              planName = "Pro Plan";
            } else if (priceId.includes("scale") || priceId.includes("enterprise")) {
              planName = "Scale Plan";
            } else {
              planName = price?.nickname || product?.name || "Active Plan";
            }
          } else {
            planName = price?.nickname || product?.name || "Active Subscription";
          }

          const currentPeriodEnd = activeSub.current_period_end
            ? new Date(activeSub.current_period_end * 1000)
            : null;

          plan = {
            name: planName,
            status: activeSub.status,
            priceId: priceId || null,
            productId: price?.product || null,
          };

          subscription = {
            id: activeSub.id,
            status: activeSub.status,
            currentPeriodEnd: currentPeriodEnd?.toISOString() || null,
            renewsOn: currentPeriodEnd
              ? currentPeriodEnd.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : null,
            cancelAtPeriodEnd: activeSub.cancel_at_period_end || false,
            canceledAt: activeSub.canceled_at
              ? new Date(activeSub.canceled_at * 1000).toISOString()
              : null,
          };
        } else {
          // No active subscription found
          plan = {
            name: "Free Plan",
            status: "none",
            priceId: null,
            productId: null,
          };
        }
      } catch (error) {
        console.error("Error fetching Stripe subscription:", error);
        plan = {
          name: "Unknown",
          status: "error",
          priceId: null,
          productId: null,
        };
      }
    } else {
      // No Stripe customer ID
      plan = {
        name: "Free Plan",
        status: "none",
        priceId: null,
        productId: null,
      };
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      plan,
      subscription,
      pendingPlan: pendingPlan ? {
        id: pendingPlan.id,
        internalId: pendingPlan.internalId,
        publicName: pendingPlan.publicName,
        creditsPerCycle: pendingPlan.creditsPerCycle,
        priceUsd: pendingPlan.priceUsd,
      } : null,
      balance: {
        userBalance,
        orgBalance,
        isOutOfSync,
      },
      autoTopUp,
      lowBalance: {
        isLow,
        threshold,
        currentBalance: userBalance,
      },
      organization: orgId
        ? {
            id: orgId,
            name: user.organizationMembers?.[0]?.organization?.name || null,
          }
        : null,
    });
  } catch (error) {
    console.error("Error in /api/me/session:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

