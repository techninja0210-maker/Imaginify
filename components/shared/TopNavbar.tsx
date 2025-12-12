"use client"

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Bell, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { ProfileDropdown } from './ProfileDropdown'

const navLinks = [
  {
    label: "Home",
    route: "/",
  },
  {
    label: "Trending",
    route: "/trending",
  },
  {
    label: "TikTok",
    route: "/tiktok-analyzer",
  },
  {
    label: "Amazon",
    route: "/amazon-analyzer",
  },
  {
    label: "Favorites",
    route: "/favorites",
  },
  {
    label: "Billing",
    route: "/billing",
  },
  {
    label: "Support",
    route: "/support",
  },
  {
    label: "Affiliate",
    route: "/affiliate",
  },
]

const TopNavbar = () => {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Don't render on trending page (it has its own integrated navbar)
  if (pathname === '/trending') {
    return null
  }

  return (
    <header className="w-full bg-white sticky top-0 z-50">
      <div className="max-w-7xl px-4 sm:px-8 mx-auto">
        <div className="w-full bg-white">
          <div className="flex items-center justify-between h-16 px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center flex-shrink-0">
            <Image
              src="/img/logo.png"
              alt="Shoppable Videos"
              width={170}
              height={38}
              className="hidden md:block h-[38px] w-auto"
              priority
            />
            <Image
              src="/img/logo-responsive.png"
              alt="Shoppable Videos"
              width={115}
              height={34}
              className="block md:hidden h-[34px] w-auto"
              priority
            />
          </Link>

          {/* Navigation Links - Hidden on mobile */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-auto mr-8">
            {navLinks.map((link) => {
              const isActive = pathname === link.route || 
                (link.route !== '/' && pathname?.startsWith(link.route))
              
              return (
                <Link
                  key={link.route}
                  href={link.route}
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right side: Mobile menu button, Bell and User Button */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-full transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 text-gray-600" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600" />
              )}
            </button>

            <button 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-gray-600" />
            </button>
            <ProfileDropdown />
          </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <nav className="lg:hidden border-t border-gray-200 py-3">
              <div className="flex flex-col space-y-1 px-6">
                {navLinks.map((link) => {
                  const isActive = pathname === link.route || 
                    (link.route !== '/' && pathname?.startsWith(link.route))
                  
                  return (
                    <Link
                      key={link.route}
                      href={link.route}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-purple-100 text-purple-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopNavbar

