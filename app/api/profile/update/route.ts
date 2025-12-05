import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateUser } from '@/lib/actions/user.actions';
import { getUserById } from '@/lib/actions/user.actions';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/update
 * Update user profile information (first name, last name)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { firstName, lastName } = body;

    // Validate input
    if (firstName !== undefined && typeof firstName !== 'string') {
      return NextResponse.json(
        { error: 'First name must be a string' },
        { status: 400 }
      );
    }

    if (lastName !== undefined && typeof lastName !== 'string') {
      return NextResponse.json(
        { error: 'Last name must be a string' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getUserById(clerkUserId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prepare update data with defaults
    const updateData: {
      firstName: string | null;
      lastName: string | null;
      username: string;
      photo: string;
    } = {
      firstName: firstName?.trim() || 'User',
      lastName: lastName?.trim() || 'Name',
      username: user.username,
      photo: user.photo,
    };

    // Update user
    const updatedUser = await updateUser(clerkUserId, updateData);

    // Revalidate profile pages
    revalidatePath('/profile');
    revalidatePath('/profile/edit');

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        username: updatedUser.username,
        email: updatedUser.email,
      },
    });
  } catch (error: any) {
    console.error('[Profile Update] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to update profile',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}


