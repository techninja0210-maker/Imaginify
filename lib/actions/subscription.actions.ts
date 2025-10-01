"use server";

import Stripe from "stripe";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export async function startSubscriptionCheckout(lineItems: Array<{ priceId: string; quantity: number }>) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: lineItems.map(item => ({
      price: item.priceId,
      quantity: item.quantity,
    })),
    metadata: {
      clerkUserId: userId,
    },
    success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/billing`,
    cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/pricing`,
  });

  redirect(session.url!);
}

export async function openCustomerPortal(customerId: string) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/billing`,
  });

  redirect(portal.url);
}


export async function openCustomerPortalWithReturnUrl(customerId: string, returnUrl: string) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  redirect(portal.url);
}



