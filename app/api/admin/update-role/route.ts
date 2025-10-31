import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database/prisma";
import { canUpdateUserRoles } from "@/lib/auth/roles";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (!user || !canUpdateUserRoles(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId: targetUserId, role } = await req.json();

    if (!targetUserId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: role as any },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update role" },
      { status: 500 }
    );
  }
}

