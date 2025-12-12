"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface ProfileEditFormProps {
  userId: string;
  clerkId: string;
  currentFirstName: string;
  currentLastName: string;
  currentUsername: string;
  currentEmail: string;
  currentPhoto: string;
}

export default function ProfileEditForm({
  userId,
  clerkId,
  currentFirstName,
  currentLastName,
  currentUsername,
  currentEmail,
  currentPhoto,
}: ProfileEditFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(currentFirstName === 'User' ? '' : currentFirstName);
  const [lastName, setLastName] = useState(currentLastName === 'Name' ? '' : currentLastName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: firstName.trim() || 'User',
          lastName: lastName.trim() || 'Name',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess(true);
      
      // Redirect to profile page after a short delay
      setTimeout(() => {
        router.push('/profile');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your profile');
      console.error('Profile update error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Profile Photo Section */}
        <div className="flex items-center gap-6 pb-6 border-b border-gray-200">
          <div className="relative group">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-gray-200">
              <Image
                src={currentPhoto}
                alt="Profile"
                fill
                className="object-cover"
                unoptimized={currentPhoto.includes('dicebear.com') || currentPhoto.includes('clerk.com')}
              />
            </div>
            <Link
              href="/profile/manage"
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <span className="text-white text-xs font-medium text-center px-2">
                Change
              </span>
            </Link>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Profile Photo</p>
            <p className="text-xs text-gray-500 mt-1">
              Click on the photo to update your profile photo, email, username, password, and active devices
            </p>
          </div>
        </div>

        {/* Email (Read-only) */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={currentEmail}
            disabled
            className="bg-gray-50 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500">
            Email cannot be changed
          </p>
        </div>

        {/* Username (Read-only) */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={currentUsername}
            disabled
            className="bg-gray-50 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500">
            Username cannot be changed
          </p>
        </div>

        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor="firstName">
            First Name <span className="text-gray-400">(optional)</span>
          </Label>
          <Input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            maxLength={50}
          />
          <p className="text-xs text-gray-500">
            If not provided, will default to &quot;User&quot;
          </p>
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName">
            Last Name <span className="text-gray-400">(optional)</span>
          </Label>
          <Input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter your last name"
            maxLength={50}
          />
          <p className="text-xs text-gray-500">
            If not provided, will default to &quot;Name&quot;
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              Profile updated successfully! Redirecting...
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button 
            type="submit" 
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}


