import Link from "next/link";
import { AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DeniedPage({
  searchParams,
}: {
  searchParams: { reason?: string; email?: string };
}) {
  const reason = searchParams.reason || "unknown";
  const email = searchParams.email || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Access Denied
        </h1>
        
        {reason === "gmail_required" && (
          <div className="space-y-4">
            <p className="text-gray-600 mb-2">
              This platform requires a Gmail account to sign in.
            </p>
            
            {email && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail className="w-4 h-4" />
                  <span>Your email: <strong>{email}</strong></span>
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-900 font-semibold mb-2">
                Please use a Gmail account:
              </p>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Sign in with a <strong>@gmail.com</strong> address</li>
                <li>Or use a <strong>@googlemail.com</strong> address</li>
              </ul>
            </div>
          </div>
        )}
        
        {reason !== "gmail_required" && (
          <p className="text-gray-600 mb-6">
            You don&apos;t have permission to access this page.
          </p>
        )}
        
        <div className="mt-8 space-y-3">
          <Button asChild className="w-full">
            <Link href="/sign-in">
              Sign In with Gmail
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="w-full">
            <Link href="/">
              Go to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}



