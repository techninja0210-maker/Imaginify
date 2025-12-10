"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Users, DollarSign, RefreshCw, TrendingUp, CreditCard, ShoppingCart, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminTabsProps {
  activeTab: string;
}

const tabs = [
  {
    id: "users",
    label: "User Management",
    icon: Users,
    href: "/admin?tab=users",
  },
  {
    id: "price-book",
    label: "Price Book",
    icon: DollarSign,
    href: "/admin?tab=price-book",
  },
  {
    id: "subscription-plans",
    label: "Subscription Plans",
    icon: CreditCard,
    href: "/admin/subscription-plans",
  },
  {
    id: "top-up-plans",
    label: "Top-Up Plans",
    icon: ShoppingCart,
    href: "/admin/top-up-plans",
  },
  {
    id: "credits",
    label: "Credit Management",
    icon: RefreshCw,
    href: "/admin?tab=credits",
  },
  {
    id: "trending",
    label: "Trending Import",
    icon: TrendingUp,
    href: "/admin?tab=trending",
  },
  {
    id: "amazon-products",
    label: "Amazon Products",
    icon: Package,
    href: "/admin/amazon-products",
  },
];

export function AdminTabs({ activeTab }: AdminTabsProps) {
  return (
    <div className="border-b border-gray-200 mb-8">
      <nav className="flex space-x-8" aria-label="Admin sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors",
                isActive
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-purple-600" : "text-gray-400")} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

