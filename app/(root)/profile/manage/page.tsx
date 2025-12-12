"use client";

import { UserProfile } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ProfileManagePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-4">
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </Link>
        </div>
      </div>

      {/* Clerk User Profile Component */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <UserProfile 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}


