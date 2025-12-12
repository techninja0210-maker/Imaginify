import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/top-up-plans
 * List all top-up plans
 */
export async function GET() {
  try {
    await requireAdmin();

    const plans = await prisma.topUpPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        purchases: {
          select: {
            id: true,
          },
        },
        autoTopUpSettings: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    console.error("[GET /api/admin/top-up-plans] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch top-up plans",
      },
      { status: error?.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

/**
 * POST /api/admin/top-up-plans
 * Create a new top-up plan
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const {
      internalId,
      publicName,
      priceUsd,
      creditsGranted,
      creditExpiryDays,
      stripePriceId,
      stripeProductId,
      canPurchaseWithoutSubscription,
      isActive,
      isHidden,
    } = body;

    // Validation
    if (
      !internalId ||
      !publicName ||
      priceUsd === undefined ||
      creditsGranted === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: internalId, publicName, priceUsd, creditsGranted",
        },
        { status: 400 }
      );
    }

    // Check if internalId already exists
    const existing = await prisma.topUpPlan.findUnique({
      where: { internalId },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Plan with internalId "${internalId}" already exists` },
        { status: 409 }
      );
    }

    // Check if stripePriceId already exists (if provided)
    if (stripePriceId) {
      const existingPrice = await prisma.topUpPlan.findUnique({
        where: { stripePriceId },
      });

      if (existingPrice) {
        return NextResponse.json(
          { error: `Plan with stripePriceId "${stripePriceId}" already exists` },
          { status: 409 }
        );
      }
    }

    // Create plan
    const plan = await prisma.topUpPlan.create({
      data: {
        internalId,
        publicName,
        priceUsd: Number(priceUsd),
        creditsGranted: Number(creditsGranted),
        creditExpiryDays: creditExpiryDays || 365,
        stripePriceId: stripePriceId || undefined,
        stripeProductId: stripeProductId || undefined,
        canPurchaseWithoutSubscription:
          canPurchaseWithoutSubscription !== undefined
            ? Boolean(canPurchaseWithoutSubscription)
            : true,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        isHidden: isHidden !== undefined ? Boolean(isHidden) : false,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/admin/top-up-plans] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to create top-up plan",
      },
      { status: error?.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

/**
 * PATCH /api/admin/top-up-plans
 * Update an existing top-up plan
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Build update data
    const data: any = {};
    if (updateData.publicName !== undefined) data.publicName = updateData.publicName;
    if (updateData.priceUsd !== undefined) data.priceUsd = Number(updateData.priceUsd);
    if (updateData.creditsGranted !== undefined)
      data.creditsGranted = Number(updateData.creditsGranted);
    if (updateData.creditExpiryDays !== undefined)
      data.creditExpiryDays = Number(updateData.creditExpiryDays);
    if (updateData.stripePriceId !== undefined)
      data.stripePriceId = updateData.stripePriceId || null;
    if (updateData.stripeProductId !== undefined)
      data.stripeProductId = updateData.stripeProductId || null;
    if (updateData.canPurchaseWithoutSubscription !== undefined)
      data.canPurchaseWithoutSubscription = Boolean(
        updateData.canPurchaseWithoutSubscription
      );
    if (updateData.isActive !== undefined)
      data.isActive = Boolean(updateData.isActive);
    if (updateData.isHidden !== undefined) data.isHidden = Boolean(updateData.isHidden);

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update plan
    const updated = await prisma.topUpPlan.update({
      where: { id },
      data,
    });

    return NextResponse.json({ plan: updated });
  } catch (error: any) {
    console.error("[PATCH /api/admin/top-up-plans] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to update top-up plan",
      },
      {
        status:
          error?.message?.includes("Unauthorized") ||
          error?.code === "P2025"
            ? error?.code === "P2025"
              ? 404
              : 403
            : 500,
      }
    );
  }
}

/**
 * DELETE /api/admin/top-up-plans
 * Delete a top-up plan
 */
export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Check if plan exists
    const plan = await prisma.topUpPlan.findUnique({
      where: { id },
      include: {
        purchases: {
          select: { id: true },
        },
        autoTopUpSettings: {
          select: { id: true, isActive: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Top-up plan not found" },
        { status: 404 }
      );
    }

    // Check if plan is used in auto top-up settings
    if (plan.autoTopUpSettings.length > 0) {
      const activeSettings = plan.autoTopUpSettings.filter(s => s.isActive);
      if (activeSettings.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot delete plan: It is currently used in Auto Top-Up Settings",
            message: `This plan is configured as the auto top-up package. Please change the Auto Top-Up Settings to use a different plan before deleting this one.`,
            details: {
              planId: plan.id,
              planName: plan.publicName,
              activeSettingsCount: activeSettings.length,
            },
          },
          { status: 409 }
        );
      }
    }

    // Check if plan has purchases (optional: warn but allow deletion)
    if (plan.purchases.length > 0) {
      // Allow deletion but warn that purchase history will have broken references
      console.warn(`[DELETE] Deleting plan ${id} with ${plan.purchases.length} purchases`);
    }

    // Delete plan
    // Note: If there are inactive auto top-up settings referencing this plan,
    // they will be orphaned but that's acceptable since they're inactive
    await prisma.topUpPlan.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Top-up plan deleted successfully",
      warning: plan.purchases.length > 0
        ? `Note: ${plan.purchases.length} purchase record(s) still reference this plan, but the plan has been deleted.`
        : undefined,
    });
  } catch (error: any) {
    console.error("[DELETE /api/admin/top-up-plans] Error:", error);
    
    // Handle foreign key constraint errors
    if (error.code === "P2003" || error.message?.includes("Foreign key constraint")) {
      return NextResponse.json(
        {
          error: "Cannot delete plan: It is referenced by other records",
          message: "This plan cannot be deleted because it is being used in Auto Top-Up Settings or has active purchases. Please update the Auto Top-Up Settings first.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: error?.message || "Failed to delete top-up plan",
      },
      {
        status:
          error?.message?.includes("Unauthorized") ||
          error?.code === "P2025"
            ? error?.code === "P2025"
              ? 404
              : 403
            : 500,
      }
    );
  }
}

