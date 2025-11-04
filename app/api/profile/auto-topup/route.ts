import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/database/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { enabled, threshold, amount } = await req.json();

    // Validate input
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid enabled value" }, { status: 400 });
    }

    if (enabled) {
      if (!threshold || threshold < 1) {
        return NextResponse.json({ error: "Threshold must be at least 1" }, { status: 400 });
      }
      if (!amount || amount < 1) {
        return NextResponse.json({ error: "Amount must be at least 1" }, { status: 400 });
      }
    }

    // Update user settings
    const user = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        autoTopUpEnabled: enabled,
        lowBalanceThreshold: enabled ? Number(threshold) : undefined,
        autoTopUpAmountCredits: enabled ? Number(amount) : null,
      },
    });

    // Also update org balance settings for backward compatibility
    const orgId = user.organizationMembers?.[0]?.organizationId;
    if (orgId) {
      await prisma.creditBalance.updateMany({
        where: { organizationId: orgId },
        data: {
          autoTopUpEnabled: enabled,
          lowBalanceThreshold: enabled ? Number(threshold) : undefined,
          autoTopUpAmountCredits: enabled ? Number(amount) : null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        enabled: user.autoTopUpEnabled,
        threshold: user.lowBalanceThreshold,
        amount: user.autoTopUpAmountCredits,
      },
    });
  } catch (error: any) {
    console.error("Error updating auto top-up settings:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
