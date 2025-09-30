"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startSubscriptionCheckout } from "@/lib/actions/subscription.actions";

const SubscribeButton = ({ 
  lineItems 
}: { 
  lineItems: Array<{ priceId: string; quantity: number }> 
}) => {
  const [isPending, startTransition] = useTransition();

  const onSubscribe = () => {
    startTransition(async () => {
      await startSubscriptionCheckout(lineItems);
    });
  };

  return (
    <Button
      type="button"
      onClick={onSubscribe}
      className="w-full rounded-full bg-purple-gradient bg-cover"
      disabled={isPending}
    >
      {isPending ? "Processing..." : "Subscribe"}
    </Button>
  );
};

export default SubscribeButton;



