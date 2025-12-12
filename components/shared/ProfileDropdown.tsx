"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { User, LogOut, ChevronDown } from 'lucide-react';

interface ProfileDropdownProps {
  avatarSize?: number;
}

export function ProfileDropdown({ avatarSize = 40 }: ProfileDropdownProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleMenuItemClick = () => {
    setIsOpen(false);
  };

  if (!user) return null;

  const userImageUrl = user.imageUrl || '/img/product-placeholder.png';
  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.username || user.emailAddresses[0]?.emailAddress || 'User';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
        aria-label="Profile menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 hover:border-purple-300 transition-colors">
          <Image
            src={userImageUrl}
            alt={displayName}
            fill
            className="object-cover"
            unoptimized={userImageUrl.includes('dicebear.com') || userImageUrl.includes('clerk.com')}
          />
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200">
                <Image
                  src={userImageUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized={userImageUrl.includes('dicebear.com') || userImageUrl.includes('clerk.com')}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              href="/profile"
              onClick={handleMenuItemClick}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User className="w-4 h-4 text-gray-500" />
              <span>Profile</span>
            </Link>

            <div className="border-t border-gray-200 my-2" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

