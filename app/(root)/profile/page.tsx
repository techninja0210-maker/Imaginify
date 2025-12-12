import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getUserById } from "@/lib/actions/user.actions";
import ProfileEditForm from "./ProfileEditForm";

export const dynamic = 'force-dynamic';

const Profile = async () => {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await getUserById(userId);
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Update your personal information
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <ProfileEditForm 
          userId={user.id}
          clerkId={userId}
          currentFirstName={user.firstName || 'User'}
          currentLastName={user.lastName || 'Name'}
          currentUsername={user.username}
          currentEmail={user.email}
          currentPhoto={user.photo}
        />
      </div>
    </div>
  );
};

export default Profile;
