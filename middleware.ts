import { authMiddleware } from "@clerk/nextjs";
 
export default authMiddleware({
  publicRoutes: ['/', '/pricing', '/legal/terms', '/legal/privacy', '/api/webhooks/clerk', '/api/webhooks/stripe', '/api/health/db', '/api/cron/keepalive', '/api/cron/auto-topup', '/api/cron/check-low-balance', '/api/credits/deductions', '/auth/denied'],
  
  // Note: Gmail validation is enforced at:
  // 1. Webhook level (user.created) - deletes non-Gmail users in Clerk
  // 2. createUser() function level - throws error if non-Gmail
  // 3. Database level - users table only contains Gmail users
  // 
  // For additional runtime protection, check user.email in protected route handlers
});
 
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};