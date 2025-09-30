import Header from "@/components/shared/Header";
import SubscribeButton from "@/components/shared/SubscribeButton";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "$10/mo",
    description: "For individuals getting started",
    features: ["100 credits", "Basic support", "Limited usage"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
  },
  {
    name: "Pro",
    price: "$30/mo",
    description: "For growing teams",
    features: ["500 credits", "Priority support", "Increased usage"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  },
  {
    name: "Business",
    price: "$60/mo",
    description: "For businesses at scale",
    features: ["1000 credits", "Priority support", "High usage"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE,
  },
];

const PricingPage = async () => {
  return (
    <>
      <Header title="Pricing" subtitle="Choose a subscription that fits your needs" />

      <section className="mt-10">
        <ul className="credits-list">
          {plans.map((plan) => (
            <li key={plan.name} className="credits-item">
              <div className="flex-center flex-col gap-3">
                <p className="p-20-semibold mt-2 text-purple-500">{plan.name}</p>
                <p className="h1-semibold text-dark-600">{plan.price}</p>
                <p className="p-16-regular text-center">{plan.description}</p>
              </div>

              <ul className="flex flex-col gap-3 py-6">
                {plan.features.map((label) => (
                  <li key={plan.name + label} className="flex items-center gap-3">
                    <span className="p-16-regular">{label}</span>
                  </li>
                ))}
              </ul>

              {plan.priceId ? (
                <SubscribeButton lineItems={[{ priceId: plan.priceId, quantity: 1 }]} />
              ) : (
                <Button disabled className="w-full rounded-full bg-purple-100 text-dark-400">
                  Configure priceId
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
};

export default PricingPage;



