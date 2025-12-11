import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/auto-top-up-settings
 * Get current auto top-up settings
 */
export async function GET() {
  try {
    await requireAdmin();

    const settings = await prisma.autoTopUpSettings.findFirst({
      where: { isActive: true },
      include: {
        topUpPlan: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      settings: settings
        ? {
            id: settings.id,
            triggerThreshold: settings.triggerThreshold,
            topUpPlanId: settings.topUpPlanId,
            topUpPlan: {
              id: settings.topUpPlan.id,
              publicName: settings.topUpPlan.publicName,
              priceUsd: settings.topUpPlan.priceUsd,
              creditsGranted: settings.topUpPlan.creditsGranted,
            },
            isActive: settings.isActive,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[AUTO_TOP_UP_SETTINGS] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/auto-top-up-settings
 * Create new auto top-up settings
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { triggerThreshold, topUpPlanId } = body;

    if (!triggerThreshold || !topUpPlanId) {
      return NextResponse.json(
        { error: "triggerThreshold and topUpPlanId are required" },
        { status: 400 }
      );
    }

    // Verify top-up plan exists
    const topUpPlan = await prisma.topUpPlan.findUnique({
      where: { id: topUpPlanId },
    });

    if (!topUpPlan) {
      return NextResponse.json(
        { error: "Top-up plan not found" },
        { status: 404 }
      );
    }

    // Deactivate existing settings
    await prisma.autoTopUpSettings.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new settings
    const settings = await prisma.autoTopUpSettings.create({
      data: {
        triggerThreshold: parseInt(triggerThreshold, 10),
        topUpPlanId,
        isActive: true,
      },
      include: {
        topUpPlan: true,
      },
    });

    return NextResponse.json({
      settings: {
        id: settings.id,
        triggerThreshold: settings.triggerThreshold,
        topUpPlanId: settings.topUpPlanId,
        topUpPlan: {
          id: settings.topUpPlan.id,
          publicName: settings.topUpPlan.publicName,
          priceUsd: settings.topUpPlan.priceUsd,
          creditsGranted: settings.topUpPlan.creditsGranted,
        },
        isActive: settings.isActive,
      },
    });
  } catch (error: any) {
    console.error("[AUTO_TOP_UP_SETTINGS] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/auto-top-up-settings
 * Update existing auto top-up settings
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id, triggerThreshold, topUpPlanId } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (triggerThreshold !== undefined) {
      updateData.triggerThreshold = parseInt(triggerThreshold, 10);
    }
    if (topUpPlanId !== undefined) {
      // Verify top-up plan exists
      const topUpPlan = await prisma.topUpPlan.findUnique({
        where: { id: topUpPlanId },
      });

      if (!topUpPlan) {
        return NextResponse.json(
          { error: "Top-up plan not found" },
          { status: 404 }
        );
      }
      updateData.topUpPlanId = topUpPlanId;
    }

    const settings = await prisma.autoTopUpSettings.update({
      where: { id },
      data: updateData,
      include: {
        topUpPlan: true,
      },
    });

    return NextResponse.json({
      settings: {
        id: settings.id,
        triggerThreshold: settings.triggerThreshold,
        topUpPlanId: settings.topUpPlanId,
        topUpPlan: {
          id: settings.topUpPlan.id,
          publicName: settings.topUpPlan.publicName,
          priceUsd: settings.topUpPlan.priceUsd,
          creditsGranted: settings.topUpPlan.creditsGranted,
        },
        isActive: settings.isActive,
      },
    });
  } catch (error: any) {
    console.error("[AUTO_TOP_UP_SETTINGS] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}

