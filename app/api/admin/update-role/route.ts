import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/database/prisma";
import { canUpdateUserRoles } from "@/lib/auth/roles";
import { UserRole } from "@prisma/client";

const ALLOWED_ROLES: UserRole[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestingUser = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: { id: true, role: true },
    });

    if (!requestingUser || !canUpdateUserRoles(requestingUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId: targetUserId, role } = body as { userId?: string; role?: UserRole };

    if (!targetUserId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === role) {
      return NextResponse.json({ success: true, message: "Role is already set" });
    }

    const isSelf = targetUser.id === requestingUser.id;
    const isTargetSuperAdmin = targetUser.role === "SUPER_ADMIN";
    const nextRole = role;
    const requesterRole = requestingUser.role;

    // Admins can only manage USER/ADMIN roles and cannot modify themselves.
    if (requesterRole === "ADMIN") {
      if (nextRole === "SUPER_ADMIN" || isTargetSuperAdmin) {
        return NextResponse.json({ error: "Insufficient privileges to manage super admins" }, { status: 403 });
      }

      if (isSelf) {
        return NextResponse.json({ error: "Admins cannot change their own role" }, { status: 403 });
      }
    }

    // Super admins must ensure at least one super admin remains in the system.
    if (requesterRole === "SUPER_ADMIN" && isTargetSuperAdmin && nextRole !== "SUPER_ADMIN") {
      const remainingSupers = await prisma.user.count({
        where: {
          role: "SUPER_ADMIN",
          NOT: { id: targetUserId },
        },
      });

      if (remainingSupers === 0) {
        return NextResponse.json(
          { error: "At least one super admin must remain in the system" },
          { status: 400 }
        );
      }
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: nextRole },
    });

    revalidatePath("/admin");

    return NextResponse.json({ success: true, message: `Role updated to ${nextRole}` });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update role" },
      { status: 500 }
    );
  }
}

