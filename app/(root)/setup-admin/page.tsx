/**
 * Temporary Admin Setup Page
 * 
 * This page allows you to grant yourself admin access.
 * Access it at: /setup-admin
 * 
 * IMPORTANT: Remove or secure this page in production!
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/prisma";
import { getUserById } from "@/lib/actions/user.actions";
import Header from "@/components/shared/Header";

const SetupAdminPage = async ({ searchParams }: { searchParams: { grant?: string } }) => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  if (!user) redirect("/sign-in");

  // Check if user is already admin
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    redirect("/admin");
  }

  // Handle grant request
  if (searchParams.grant === 'true') {
    await prisma.user.update({
      where: { clerkId: userId },
      data: { role: 'ADMIN' }
    });
    redirect("/admin?granted=true");
  }

  return (
    <>
      <Header 
        title="Grant Admin Access" 
        subtitle="This page allows you to grant yourself admin privileges"
      />
      <section className="mt-10">
        <div className="collection-card p-6 max-w-2xl">
          <h2 className="h3-bold mb-4">Current Status</h2>
          <div className="space-y-2 mb-6">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Current Role:</strong> <span className="text-purple-500">{user.role}</span></p>
            <p><strong>Clerk ID:</strong> {user.clerkId}</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Note:</strong> This is a temporary setup page. In production, you should:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove this page or secure it with additional checks</li>
                <li>Use the database script: <code className="bg-gray-100 px-1 rounded">node scripts/grant-admin.js &lt;email&gt;</code></li>
                <li>Or manually update the database: <code className="bg-gray-100 px-1 rounded">UPDATE users SET role = &apos;ADMIN&apos; WHERE email = &apos;your-email@gmail.com&apos;</code></li>
              </ul>
            </p>
          </div>

          <form action="/setup-admin" method="get">
            <input type="hidden" name="grant" value="true" />
            <button 
              type="submit" 
              className="btn bg-purple-gradient text-white"
            >
              Grant Me Admin Access
            </button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <h3 className="h4-bold mb-2">Alternative: Use Script</h3>
            <p className="text-sm text-gray-600 mb-2">
              Run this command in your terminal:
            </p>
            <code className="block bg-gray-100 p-3 rounded text-sm">
              node scripts/grant-admin.js {user.email}
            </code>
          </div>
        </div>
      </section>
    </>
  );
};

export default SetupAdminPage;

