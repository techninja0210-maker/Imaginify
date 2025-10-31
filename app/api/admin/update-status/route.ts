import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database/prisma";
import { canDeleteUsers } from "@/lib/auth/roles";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true, id: true },
    });

    if (!user || !canDeleteUsers(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId: targetUserId, isActive } = await req.json();

    if (!targetUserId || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Missing userId or isActive" }, { status: 400 });
    }

    // Prevent self-deactivation
    if (user.id === targetUserId) {
      return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update status" },
      { status: 500 }
    );
  }
}

