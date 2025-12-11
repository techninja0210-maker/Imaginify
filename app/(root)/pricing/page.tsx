import Header from "@/components/shared/Header";
import { SubscriptionForm } from "@/components/shared/SubscriptionForm";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { prisma } from "@/lib/database/prisma";

const PricingPage = async () => {
  // Fetch active subscription plans from database
  // Only show plans that are:
  // - Active for new signups (isActiveForNewSignups = true)
  // - Not legacy-only (isLegacyOnly = false)
  // - Not hidden (isHidden = false)
  const dbPlans = await prisma.subscriptionPlan.findMany({
    where: {
      isActiveForNewSignups: true,
      isLegacyOnly: false,
      isHidden: false,
    },
    orderBy: [
      { priceUsd: "asc" }, // Sort by price ascending
    ],
  });

  // Transform database plans to UI format
  // If no plans in DB, fallback to hardcoded plans
  const plans = dbPlans.length > 0
    ? dbPlans.map((plan, index) => ({
        id: plan.id,
        internalId: plan.internalId,
        name: plan.publicName,
        price: `$${plan.priceUsd}`,
        priceId: plan.stripePriceId || null,
        description: `${plan.planFamily} plan with ${plan.creditsPerCycle.toLocaleString()} credits per month`,
        features: [
          `${plan.creditsPerCycle.toLocaleString()} credits per month`,
          "All AI transformations",
          "Email support",
          "Access to core features",
          plan.creditsPerCycle >= 500 ? "Priority support" : "Standard support",
          plan.creditsPerCycle >= 1000 ? "API access" : null,
        ].filter(Boolean) as string[],
        credits: plan.creditsPerCycle,
        popular: index === 1, // Middle plan is popular
        isDefault: plan.isDefaultForSignup,
      }))
    : [
        // Fallback to hardcoded plans if database is empty
        {
          id: "fallback-starter",
          internalId: "sub_starter_v1",
          name: "Starter",
          price: "$10",
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
          description: "Perfect for getting started",
          features: [
            "100 credits per month",
            "Basic AI transformations",
            "Email support",
            "Access to core features",
            "Community forum access",
          ],
          credits: 100,
          popular: false,
          isDefault: false,
        },
        {
          id: "fallback-pro",
          internalId: "sub_pro_v1",
          name: "Pro",
          price: "$30",
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
          description: "For growing teams and professionals",
          features: [
            "500 credits per month",
            "All AI transformations",
            "Priority email support",
            "Advanced features",
            "Early access to new tools",
            "Analytics dashboard",
          ],
          credits: 500,
          popular: true,
          isDefault: false,
        },
        {
          id: "fallback-business",
          internalId: "sub_business_v1",
          name: "Business",
          price: "$60",
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SCALE,
          description: "For businesses at scale",
          features: [
            "1000 credits per month",
            "All AI transformations",
            "Priority support (24/7)",
            "Advanced features",
            "Early access to new tools",
            "Analytics dashboard",
            "API access",
            "Custom integrations",
          ],
          credits: 1000,
          popular: false,
          isDefault: false,
        },
      ];
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              Choose the plan that works best for you
            </p>
            <p className="text-sm text-gray-500">
              All plans include access to our AI-powered transformation tools
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-xl ${
                plan.popular
                  ? "border-purple-500 shadow-lg scale-105 md:scale-105 lg:scale-110 z-10"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-8">
                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mb-6">{plan.description}</p>
                  
                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-xl text-gray-600">/month</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {plan.credits.toLocaleString()} credits included
                    </p>
                  </div>
                </div>

                {/* Features List */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                        <Check className="w-5 h-5 text-green-500" strokeWidth={2.5} />
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <div className="mt-auto">
                  {plan.priceId ? (
                    <SubscriptionForm
                      lineItems={[{ priceId: plan.priceId, quantity: 1 }]}
                      className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                        plan.popular
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                          : "bg-gray-900 text-white hover:bg-gray-800"
                      }`}
                    />
                  ) : (
                    <Button 
                      disabled 
                      className="w-full py-3 px-6 rounded-lg font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
                    >
                      Coming Soon
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I change plans later?
              </h3>
              <p className="text-gray-600 text-sm">
                Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated and applied to your next billing cycle.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What happens to unused credits?
              </h3>
              <p className="text-gray-600 text-sm">
                Credits reset at the start of each billing cycle. Unused credits do not roll over to the next month.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600 text-sm">
                We offer a 14-day money-back guarantee for all new subscriptions. Contact support for assistance.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">Need a custom plan for your team?</p>
          <Button
            variant="outline"
            className="px-8 py-3 rounded-lg border-2 border-purple-600 text-purple-600 hover:bg-purple-50 font-semibold"
          >
            Contact Sales
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
