"use client";

import { usePathname } from 'next/navigation';
import TopNavbar from './TopNavbar';
import { LowBalanceBanner } from './LowBalanceBanner';

export function ConditionalTopNavbar() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAdminRoute) {
    return null; // Don't render user navbar on admin routes
  }

  return (
    <>
      <TopNavbar />
      <LowBalanceBanner />
    </>
  );
}

