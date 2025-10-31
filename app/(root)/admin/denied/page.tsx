/**
 * Admin Access Denied Page
 * Shows when a non-admin user tries to access /admin
 */

import Header from "@/components/shared/Header";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/actions/user.actions";
import Link from "next/link";

const AdminDeniedPage = async () => {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const user = await getUserById(userId);
  if (!user) redirect("/sign-in");

  return (
    <>
      <Header 
        title="Admin Access Required" 
        subtitle="You need admin privileges to access this page"
      />
      <section className="mt-10">
        <div className="collection-card p-6 max-w-2xl">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h2 className="h3-bold text-red-800 mb-2">❌ Access Denied</h2>
            <p className="text-red-700">
              You need <strong>ADMIN</strong> or <strong>SUPER_ADMIN</strong> role to access the admin console.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="h4-bold mb-2">Your Current Status</h3>
              <div className="space-y-2">
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Current Role:</strong> <span className="text-purple-500 font-semibold">{user.role}</span></p>
                <p><strong>Clerk ID:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-sm">{user.clerkId}</code></p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="h4-bold mb-2">How to Get Admin Access</h3>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold mb-1">Option 1: Use Setup Page (Easiest)</p>
                  <Link href="/setup-admin" className="text-blue-600 hover:underline">
                    → Go to /setup-admin page
                  </Link>
                </div>
                <div>
                  <p className="font-semibold mb-1">Option 2: Use API Endpoint</p>
                  <p className="text-sm text-gray-600 mb-1">
                    Call: <code className="bg-gray-100 px-2 py-1 rounded">POST /api/admin/grant-access</code>
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Option 3: Run Script</p>
                  <p className="text-sm text-gray-600 mb-1">
                    Run: <code className="bg-gray-100 px-2 py-1 rounded">node scripts/grant-admin.js {user.email}</code>
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Option 4: Database Update</p>
                  <p className="text-sm text-gray-600">
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      UPDATE users SET role = 'ADMIN' WHERE email = '{user.email}';
                    </code>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/setup-admin" className="btn bg-purple-gradient text-white">
                Grant Admin Access
              </Link>
              <Link href="/" className="btn bg-gray-100 text-gray-700">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AdminDeniedPage;

