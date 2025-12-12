import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/actions/user.actions";

export const dynamic = "force-dynamic";

/**
 * Redirect page that handles role-based routing after sign-in
 * - Regular users (USER) -> / (home page)
 * - Admins (ADMIN/SUPER_ADMIN) -> /admin
 */
export default async function RedirectPage({
  searchParams,
}: {
  searchParams?: { redirect_url?: string | string[] };
}) {
  const { userId } = auth();

  if (!userId) {
    // Not signed in, redirect to sign-in
    redirect("/sign-in");
  }

  const user = await getUserById(userId).catch(() => null);
  
  if (!user) {
    // User not found in database, redirect to home
    redirect("/");
  }

  // IMPORTANT: Admins ALWAYS go to /admin after sign-in, regardless of redirect_url
  // This ensures admins always start at the admin panel after signing in
  // Regular users can be redirected to their intended destination
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }

  // For regular users, check if there's a redirect_url from protected routes
  const redirectUrl = searchParams?.redirect_url;
  if (redirectUrl) {
    const url = Array.isArray(redirectUrl) ? redirectUrl[0] : redirectUrl;
    if (typeof url === 'string' && url) {
      redirect(url);
    }
  }

  // Regular user, go to home page
  redirect("/");
}

