import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database/prisma";
import { updateCredits } from "@/lib/actions/user.actions";
import { canUpdateUserCredits } from "@/lib/auth/roles";

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

    if (!user || !canUpdateUserCredits(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clerkId, delta, reason } = await req.json();

    if (!clerkId || !delta || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: "Invalid credit amount" }, { status: 400 });
    }

    if (reason.trim().length < 3) {
      return NextResponse.json({ error: "Reason must be at least 3 characters" }, { status: 400 });
    }

    try {
      const updatedUser = await updateCredits(
        clerkId,
        delta,
        `Admin adjustment: ${reason.trim()}`,
        undefined
      );

      return NextResponse.json({
        success: true,
        newBalance: updatedUser.creditBalance,
      });
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to update credits";
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

