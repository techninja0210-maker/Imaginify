"use client";

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Users, DollarSign, CreditCard, ShoppingCart, RefreshCw, TrendingUp, Package, Zap, Home } from 'lucide-react';
import { ProfileDropdown } from '@/components/shared/ProfileDropdown';

const adminNavLinks = [
  {
    label: "Users",
    route: "/admin?tab=users",
    icon: Users,
  },
  {
    label: "Price Book",
    route: "/admin?tab=price-book",
    icon: DollarSign,
  },
  {
    label: "Subscriptions",
    route: "/admin/subscription-plans",
    icon: CreditCard,
  },
  {
    label: "Top-Ups",
    route: "/admin/top-up-plans",
    icon: ShoppingCart,
  },
  {
    label: "Credits",
    route: "/admin?tab=credits",
    icon: RefreshCw,
  },
  {
    label: "Trending",
    route: "/admin?tab=trending",
    icon: TrendingUp,
  },
  {
    label: "Amazon",
    route: "/admin/amazon-products",
    icon: Package,
  },
  {
    label: "Auto Top-Up",
    route: "/admin?tab=auto-top-up",
    icon: Zap,
  },
];

const AdminNavbar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Check if current route matches a nav link (for active state)
  const isRouteActive = (route: string) => {
    // For query-based routes, check URL search params
    if (route.includes('?tab=')) {
      const tab = route.split('tab=')[1];
      // Check if pathname is /admin and URL has the matching tab param
      if (pathname === '/admin') {
        const currentTab = searchParams?.get('tab') || 'users'; // Default to 'users'
        return currentTab === tab;
      }
      return false;
    }
    // For direct routes, check exact match or starts with
    if (route === '/admin/subscription-plans') {
      return pathname === '/admin/subscription-plans' || pathname?.startsWith('/admin/subscription-plans');
    }
    if (route === '/admin/top-up-plans') {
      return pathname === '/admin/top-up-plans' || pathname?.startsWith('/admin/top-up-plans');
    }
    if (route === '/admin/amazon-products') {
      return pathname === '/admin/amazon-products' || pathname?.startsWith('/admin/amazon-products');
    }
    return pathname === route || pathname?.startsWith(route);
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl px-4 sm:px-8 mx-auto">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/admin" className="flex items-center flex-shrink-0">
            <Image
              src="/img/logo.png"
              alt="Shoppable Videos Admin"
              width={170}
              height={38}
              className="hidden md:block h-[38px] w-auto"
              priority
            />
            <Image
              src="/img/logo-responsive.png"
              alt="Shoppable Videos Admin"
              width={115}
              height={34}
              className="block md:hidden h-[34px] w-auto"
              priority
            />
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 ml-auto mr-8">
            {adminNavLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isRouteActive(link.route);
              
              return (
                <Link
                  key={link.route}
                  href={link.route}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right side: Home and Profile */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-full transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              aria-label="Go to user panel"
              title="Go to user panel"
            >
              <Home className="w-5 h-5 text-gray-600" />
            </Link>
            <ProfileDropdown />
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className="lg:hidden border-t border-gray-200 py-3">
          <div className="flex flex-wrap gap-2">
            {adminNavLinks.map((link) => {
              const Icon = link.icon;
              const isActive = isRouteActive(link.route);
              
              return (
                <Link
                  key={link.route}
                  href={link.route}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminNavbar;

