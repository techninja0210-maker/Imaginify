"use client";

import { loadStripe } from "@stripe/stripe-js";
import { useEffect } from "react";

import { useToast } from "@/components/ui/use-toast";
import { checkoutCredits } from "@/lib/actions/transaction.action";

import { Button } from "../ui/button";

const Checkout = ({
  plan,
  amount,
  credits,
  buyerId,
}: {
  plan: string;
  amount: number;
  credits: number;
  buyerId: string;
}) => {
  const { toast } = useToast();

  useEffect(() => {
    loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }, []);

  useEffect(() => {
    // Check to see if this is a redirect back from Checkout
    const query = new URLSearchParams(window.location.search);
    if (query.get("success")) {
      const sessionId = query.get("session_id");
      if (sessionId) {
        // Confirm credits in case webhooks aren't available locally
        fetch(`/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`)
          .then(async (res) => {
            const data = await res.json();
            console.log('[CHECKOUT] Credit confirmation response:', data);
            
            if (res.ok && !data.skipped) {
              // Successfully confirmed - refresh page to show updated credits
              toast({
                title: "Credits added!",
                description: `${data.creditsGranted || ''} credits have been added. New balance: ${data.newBalance || 'checking...'}`,
                duration: 4000,
                className: "success-toast",
              });
              // Force hard refresh to clear cache
              setTimeout(() => {
                window.location.href = '/';
              }, 2500);
            } else if (data.skipped) {
              // Already processed - just refresh
              toast({
                title: "Credits already processed",
                description: "Your credits should already be in your account.",
                duration: 3000,
                className: "success-toast",
              });
              setTimeout(() => {
                window.location.href = '/';
              }, 2000);
            } else {
              // Error - show detailed error
              console.error('[CHECKOUT] Credit confirmation error:', data);
              toast({
                title: "Credit processing issue",
                description: data.error || data.details || "Please check console for details. Webhook may handle it.",
                duration: 5000,
                className: "error-toast",
              });
              // Still refresh after delay in case webhook handles it
              setTimeout(() => {
                window.location.href = '/';
              }, 3000);
            }
          })
          .catch((err) => {
            console.error('Credit confirmation fetch error:', err);
            // Still refresh - webhook might handle it
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          });
      }
      toast({
        title: "Order placed!",
        description: "Credits are being added to your account...",
        duration: 5000,
        className: "success-toast",
      });
    }

    if (query.get("canceled")) {
      toast({
        title: "Order canceled!",
        description: "Continue to shop around and checkout when you're ready",
        duration: 5000,
        className: "error-toast",
      });
    }
  }, [toast]);

  const onCheckout = async () => {
    const transaction = {
      plan,
      amount,
      credits,
      buyerId,
    };

    await checkoutCredits(transaction);
  };

  return (
    <form action={onCheckout}>
      <section>
        <Button
          type="submit"
          role="link"
          className="w-full rounded-full bg-purple-gradient bg-cover"
        >
          Buy Credit
        </Button>
      </section>
    </form>
  );
};

export default Checkout;