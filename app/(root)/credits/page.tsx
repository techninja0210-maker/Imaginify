import { SignedIn, auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { plans } from "@/constants";
import { getUserById } from "@/lib/actions/user.actions";
import Checkout from "@/components/shared/Checkout";
import { Button } from "@/components/ui/button";
import { Check, X, Sparkles, Zap, Crown } from "lucide-react";
import { CreditBreakdown } from "@/components/shared/CreditBreakdown";

const Credits = async () => {
  const { userId } = auth();

  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  
  if (!user) {
    redirect("/sign-in");
  }

  // Use raw creditBalance as the source of truth (includes all credits, including legacy grants)
  // Note: Credits page uses CreditBreakdown component which fetches its own data from /api/me/credits-breakdown
  // This calculation is here for consistency but may not be used if CreditBreakdown is displayed
  const effectiveBalance = user.creditBalance || 0;

  // Enhance plans with value calculations and badges
  const enhancedPlans = plans.map((plan, index) => {
    const pricePerCredit = plan.price > 0 ? plan.price / plan.credits : 0;
    const isBestValue = index === 1; // Pro Package is typically best value
    const isPremium = index === 2; // Premium Package

    return {
      ...plan,
      pricePerCredit,
      isBestValue,
      isPremium,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
              Buy Credits
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              Choose a credit package that suits your needs
            </p>
            <p className="text-sm text-gray-500">
              Top-up credits expire after 12 months. Subscription credits expire at the end of each billing cycle.
            </p>
          </div>
        </div>
      </div>

      {/* Credit Breakdown */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <CreditBreakdown />
      </div>

      {/* Credit Packages */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
          {enhancedPlans.map((plan, index) => {
            const IconComponent = index === 0 ? Sparkles : index === 1 ? Zap : Crown;
            const iconColor = index === 0 ? "from-blue-500 to-blue-600" : index === 1 ? "from-purple-500 to-indigo-600" : "from-yellow-500 to-orange-500";

            return (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl shadow-sm border-2 transition-all hover:shadow-xl ${
                  plan.isBestValue
                    ? "border-purple-500 shadow-lg scale-105 md:scale-105 lg:scale-110 z-10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {/* Best Value Badge */}
                {plan.isBestValue && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg">
                      Best Value
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Header */}
                  <div className="text-center mb-8">
                    {/* Icon */}
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${iconColor} flex items-center justify-center shadow-lg`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    
                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline justify-center gap-2">
                        <span className="text-5xl font-bold text-gray-900">${plan.price}</span>
                        {plan.price > 0 && (
                          <span className="text-sm text-gray-500">one-time</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {plan.credits.toLocaleString()} Credits
                      </p>
                      {plan.pricePerCredit > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          ${plan.pricePerCredit.toFixed(3)} per credit
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-4 mb-8">
                    {plan.inclusions.map((inclusion, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                          {inclusion.isIncluded ? (
                            <Check className="w-5 h-5 text-green-500" strokeWidth={2.5} />
                          ) : (
                            <X className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
                          )}
                        </div>
                        <span className={`text-sm leading-relaxed ${
                          inclusion.isIncluded ? "text-gray-700" : "text-gray-400 line-through"
                        }`}>
                          {inclusion.label}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <div className="mt-auto">
                    {plan.name === "Free" ? (
                      <Button 
                        variant="outline" 
                        className="w-full py-3 px-6 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled
                      >
                        Free Package
                      </Button>
                    ) : (
                      <SignedIn>
                        {user && (
                          <Checkout
                            plan={plan.name}
                            amount={plan.price}
                            credits={plan.credits}
                            buyerId={user.clerkId}
                            className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                              plan.isBestValue
                                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                                : plan.isPremium
                                ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 shadow-lg hover:shadow-xl"
                                : "bg-gray-900 text-white hover:bg-gray-800"
                            }`}
                          />
                        )}
                      </SignedIn>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Value Comparison */}
        <div className="mt-16 max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
              Why choose credit packages?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Flexible Usage</h3>
                <p className="text-sm text-gray-600">
                  Use credits whenever you need them, no monthly commitments
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Long Validity</h3>
                <p className="text-sm text-gray-600">
                  Top-up credits are valid for 12 months from purchase
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-green-100 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Best Value</h3>
                <p className="text-sm text-gray-600">
                  Larger packages offer better value per credit
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Do credits expire?
              </h3>
              <p className="text-gray-600 text-sm">
                Top-up credits expire after 12 months from purchase. Subscription credits expire at the end of each billing cycle (30 days). Credits are used in order: subscription credits first, then top-up credits (earliest expiring first).
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I buy more credits later?
              </h3>
              <p className="text-gray-600 text-sm">
                Yes, you can purchase additional credit packages at any time. Credits will be added to your existing balance.
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600 text-sm">
                We accept all major credit cards through our secure Stripe payment processor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Credits;
