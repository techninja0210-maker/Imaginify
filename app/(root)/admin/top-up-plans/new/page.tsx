import { requireAdmin } from "@/lib/auth/admin-auth";
import { TopUpPlanForm } from "@/components/admin/TopUpPlanForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const NewTopUpPlanPage = async () => {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/top-up-plans"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Back to Top-Up Plans"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">New Top-Up Plan</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create a new one-time credit pack
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <TopUpPlanForm plan={null} />
        </div>
      </div>
    </div>
  );
};

export default NewTopUpPlanPage;

