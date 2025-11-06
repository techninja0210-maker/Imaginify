"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { grantCreditsForSession } from "@/lib/actions/credit-grant.action";

/**
 * Client-side component to ensure credits are granted automatically
 * when returning from Stripe checkout, even if server-side grant fails
 */
export function AutoGrantCredits() {
  const { toast } = useToast();
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    // ALWAYS log on mount to verify component is running
    console.log('[AUTO_GRANT_CREDITS] ✅ Component mounted and running!');
    
    // Check to see if this is a redirect back from Checkout IMMEDIATELY
    const query = new URLSearchParams(window.location.search);
    const success = query.get("success");
    const sessionId = query.get("session_id");
    
    // Log full URL and all query params for debugging
    const allParams: Record<string, string> = {};
    query.forEach((value, key) => {
      allParams[key] = value;
    });
    
    console.log('[AUTO_GRANT_CREDITS] Component mounted, checking URL params:', { 
      success, 
      sessionId,
      allParams,
      fullUrl: window.location.href,
      searchString: window.location.search,
      hasProcessed,
      timestamp: new Date().toISOString()
    });
    
    // Only process if we have both success=1 and session_id
    if ((success === "1" || success === "true") && sessionId) {
      console.log('[AUTO_GRANT_CREDITS] ✅ Conditions met! Processing credit grant...');
      // Check localStorage to prevent double execution
      const processedKey = `credit_grant_${sessionId}`;
      const alreadyProcessed = typeof window !== 'undefined' ? localStorage.getItem(processedKey) : null;
      
      if (alreadyProcessed) {
        console.log('[AUTO_GRANT_CREDITS] Already processed this session, skipping');
        return;
      }
      
      // Mark as processed immediately
      if (typeof window !== 'undefined') {
        localStorage.setItem(processedKey, 'true');
      }
      setHasProcessed(true);
      console.log('[AUTO_GRANT_CREDITS] ✅ Detected successful checkout, sessionId:', sessionId);
      
      // Show initial toast
      toast({
        title: "Payment successful!",
        description: "Processing your credits...",
        duration: 3000,
        className: "success-toast",
      });

      // Try server action FIRST (faster, more reliable)
      console.log('[AUTO_GRANT_CREDITS] 🚀 Trying server action first for session:', sessionId);
      
      grantCreditsForSession(sessionId)
        .then((result) => {
          console.log('[AUTO_GRANT_CREDITS] Server action response:', result);
          
          if (result.success && !result.skipped && result.creditsGranted) {
            // Successfully granted - show success and refresh IMMEDIATELY
            console.log('[AUTO_GRANT_CREDITS] ✅ Credits granted successfully via server action!', {
              creditsGranted: result.creditsGranted,
              newBalance: result.newBalance
            });
            
            toast({
              title: "Credits added!",
              description: `${result.creditsGranted || ''} credits have been added. New balance: ${result.newBalance || 'checking...'}`,
              duration: 4000,
              className: "success-toast",
            });
            
            // Remove query params immediately
            window.history.replaceState({}, '', '/');
            
            // Force hard refresh IMMEDIATELY to show updated balance
            console.log('[AUTO_GRANT_CREDITS] ✅ Credits granted! Refreshing page to show updated balance...');
            
            // Force a full page reload to ensure fresh data from server
            // This will show the updated credit balance immediately
            setTimeout(() => {
              console.log('[AUTO_GRANT_CREDITS] 🔄 Refreshing page to show updated credits...');
              // Force a full page reload - this ensures fresh data is fetched from server
              window.location.href = window.location.origin + '/';
            }, 1200);
          } else if (result.skipped) {
            // Already processed - just refresh
            toast({
              title: "Credits already processed",
              description: "Your credits should already be in your account.",
              duration: 3000,
              className: "success-toast",
            });
            setTimeout(() => {
              window.history.replaceState({}, '', '/');
              window.location.reload();
            }, 1000);
          } else {
            // Server action failed - try API endpoint as fallback
            console.warn('[AUTO_GRANT_CREDITS] Server action failed, trying API endpoint:', result.error);
            return fetch(`/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`, {
              cache: 'no-store',
              method: 'GET',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            })
              .then(async (res) => {
                const data = await res.json();
                console.log('[AUTO_GRANT_CREDITS] API fallback response:', data);
                
                if (res.ok && !data.skipped && (data.creditsGranted || data.success)) {
                  toast({
                    title: "Credits added!",
                    description: `${data.creditsGranted || ''} credits have been added. New balance: ${data.newBalance || 'checking...'}`,
                    duration: 4000,
                    className: "success-toast",
                  });
                  window.history.replaceState({}, '', '/');
                  setTimeout(() => {
                    console.log('[AUTO_GRANT_CREDITS] 🔄 Refreshing page after API fallback...');
                    window.location.href = window.location.origin + '/';
                  }, 800);
                } else {
                  console.error('[AUTO_GRANT_CREDITS] API fallback also failed:', data);
                  toast({
                    title: "Credit processing issue",
                    description: data.error || result.error || "Please check console for details. Webhook may handle it.",
                    duration: 5000,
                    className: "error-toast",
                  });
                  setTimeout(() => {
                    window.history.replaceState({}, '', '/');
                    window.location.reload();
                  }, 3000);
                }
              })
              .catch((err) => {
                console.error('[AUTO_GRANT_CREDITS] API fallback error:', err);
                toast({
                  title: "Processing...",
                  description: "Webhook will process your credits shortly. Please refresh in a moment.",
                  duration: 5000,
                  className: "info-toast",
                });
                setTimeout(() => {
                  window.history.replaceState({}, '', '/');
                  window.location.reload();
                }, 2000);
              });
          }
        })
        .catch((err) => {
          console.error('[AUTO_GRANT_CREDITS] Server action error:', err);
          // Fallback to API endpoint
          fetch(`/api/stripe/confirm?session_id=${encodeURIComponent(sessionId)}`, {
            cache: 'no-store',
            method: 'GET'
          })
            .then(async (res) => {
              const data = await res.json();
              if (res.ok && !data.skipped && (data.creditsGranted || data.success)) {
                toast({
                  title: "Credits added!",
                  description: `${data.creditsGranted || ''} credits have been added.`,
                  duration: 4000,
                  className: "success-toast",
                });
                window.history.replaceState({}, '', '/');
                setTimeout(() => {
                  console.log('[AUTO_GRANT_CREDITS] 🔄 Refreshing page after error fallback...');
                  window.location.href = window.location.origin + '/';
                }, 800);
              }
            })
            .catch(() => {
              toast({
                title: "Processing...",
                description: "Webhook will process your credits shortly.",
                duration: 5000,
                className: "info-toast",
              });
            });
        });
    } else {
      console.log('[AUTO_GRANT_CREDITS] ⚠️ No success params found, skipping auto-grant. URL:', window.location.href);
      console.log('[AUTO_GRANT_CREDITS] If you just bought credits, check that the URL contains ?success=1&session_id=xxx');
    }
  }, [toast, hasProcessed]);

  // Also check on window focus/hash change (in case URL changes after component mounts)
  useEffect(() => {
    const handleLocationChange = () => {
      const query = new URLSearchParams(window.location.search);
      const success = query.get("success");
      const sessionId = query.get("session_id");
      
      if ((success === "1" || success === "true") && sessionId && !hasProcessed) {
        console.log('[AUTO_GRANT_CREDITS] 🔄 Detected URL change with success params, triggering grant...');
        // Trigger the grant logic
        const processedKey = `credit_grant_${sessionId}`;
        if (typeof window !== 'undefined' && !localStorage.getItem(processedKey)) {
          // Re-run the grant logic by simulating the effect
          window.location.reload();
        }
      }
    };

    window.addEventListener('focus', handleLocationChange);
    return () => window.removeEventListener('focus', handleLocationChange);
  }, [hasProcessed]);

  return null; // This component doesn't render anything
}

