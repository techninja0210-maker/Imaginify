"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startSubscriptionCheckout } from "@/lib/actions/subscription.actions";
import { cn } from "@/lib/utils";

const SubscribeButton = ({ 
  lineItems,
  className 
}: { 
  lineItems: Array<{ priceId: string; quantity: number }>;
  className?: string;
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
      className={cn("w-full", className || "rounded-full bg-purple-gradient bg-cover")}
      disabled={isPending}
    >
      {isPending ? "Processing..." : "Subscribe"}
    </Button>
  );
};

export default SubscribeButton;



