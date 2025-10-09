import { authMiddleware } from "@clerk/nextjs";
 
export default authMiddleware({
  publicRoutes: ['/', '/pricing', '/legal/terms', '/legal/privacy', '/api/webhooks/clerk', '/api/webhooks/stripe', '/api/health/db', '/api/cron/keepalive', '/api/cron/auto-topup']
});
 
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};