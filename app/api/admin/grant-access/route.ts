/**
 * POST /api/admin/grant-access
 * 
 * Grants ADMIN role to the current user
 * This is a temporary endpoint for development - remove or secure in production!
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/database/prisma';

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already admin
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return NextResponse.json({ 
        success: true, 
        message: 'User already has admin access',
        role: user.role 
      });
    }

    // Grant admin access
    const updated = await prisma.user.update({
      where: { clerkId: userId },
      data: { role: 'ADMIN' },
      select: {
        email: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Admin access granted successfully',
      email: updated.email,
      role: updated.role,
    });

  } catch (error: any) {
    console.error('[POST /api/admin/grant-access] Error:', error);
    return NextResponse.json({
      error: error?.message || 'Failed to grant admin access',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

