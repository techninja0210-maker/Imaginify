"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { grantCreditsForSession } from "@/lib/actions/credit-grant.action";
import { RefreshCw } from "lucide-react";
import { InlineLoader } from "./Loader";

/**
 * Manual credit grant button - fallback if automatic grant doesn't work
 * Shows when URL has success=1&session_id=xxx but credits weren't granted
 */
export function ManualCreditGrant() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Check URL params on client side only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const query = new URLSearchParams(window.location.search);
    const success = query.get("success");
    const sid = query.get("session_id");
    
    // Only show if we have success params
    if (success && sid && (success === "1" || success === "true")) {
      setShowButton(true);
      setSessionId(sid);
    }
  }, []);
  
  // Don't render anything until client-side check is done
  if (!showButton || !sessionId) {
    return null;
  }

  const handleGrant = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    toast({
      title: "Granting credits...",
      description: "Please wait while we process your credits.",
      duration: 3000,
      className: "info-toast",
    });

    try {
      const result = await grantCreditsForSession(sessionId);
      
      if (result.success && result.creditsGranted) {
        toast({
          title: "Credits granted!",
          description: `${result.creditsGranted} credits have been added. New balance: ${result.newBalance}`,
          duration: 4000,
          className: "success-toast",
        });
        
        // Remove query params and refresh
        window.history.replaceState({}, '', '/');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else if (result.skipped) {
        toast({
          title: "Already processed",
          description: "Credits have already been granted for this purchase.",
          duration: 3000,
          className: "info-toast",
        });
        window.history.replaceState({}, '', '/');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to grant credits. Please try the admin panel.",
          duration: 5000,
          className: "error-toast",
        });
      }
    } catch (error: any) {
      console.error('[MANUAL_GRANT] Error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to grant credits. Please try the admin panel.",
        duration: 5000,
        className: "error-toast",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-purple-200 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Grant Credits
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Click to manually grant credits for your purchase.
            </p>
            <Button
              onClick={handleGrant}
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-sm"
            >
              {isLoading ? (
                <InlineLoader text="Processing..." size="sm" />
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Grant Credits
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

