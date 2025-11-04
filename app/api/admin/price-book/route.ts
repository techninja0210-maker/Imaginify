import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/database/prisma";
import { requireAdmin } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/price-book
 * List all price book entries across all organizations
 */
export async function GET() {
  try {
    await requireAdmin();

    const entries = await prisma.priceBookEntry.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            clerkId: true,
          },
        },
      },
      orderBy: [
        { organizationId: "asc" },
        { actionKey: "asc" },
      ],
    });

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("[GET /api/admin/price-book] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch price book entries" },
      { status: error?.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

/**
 * POST /api/admin/price-book
 * Create a new price book entry
 * Body: { organizationId, actionKey, unitType, unitStep, retailCostPerUnit, internalCostFormula, isActive }
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const {
      organizationId,
      actionKey,
      unitType,
      unitStep,
      retailCostPerUnit,
      internalCostFormula,
      isActive,
    } = body;

    // Validation
    if (!organizationId || !actionKey || !unitType || retailCostPerUnit === undefined || !internalCostFormula) {
      return NextResponse.json(
        { error: "Missing required fields: organizationId, actionKey, unitType, retailCostPerUnit, internalCostFormula" },
        { status: 400 }
      );
    }

    // Check if entry already exists
    const existing = await prisma.priceBookEntry.findUnique({
      where: {
        organizationId_actionKey: {
          organizationId,
          actionKey,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Price book entry already exists for ${actionKey} in this organization` },
        { status: 409 }
      );
    }

    // Validate organization exists
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Create entry
    const entry = await prisma.priceBookEntry.create({
      data: {
        organizationId,
        actionKey,
        unitType,
        unitStep: unitStep || 1,
        retailCostPerUnit: Number(retailCostPerUnit),
        internalCostFormula,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            clerkId: true,
          },
        },
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/admin/price-book] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create price book entry" },
      { status: error?.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

/**
 * PATCH /api/admin/price-book
 * Update an existing price book entry
 * Body: { id, unitType?, unitStep?, retailCostPerUnit?, internalCostFormula?, isActive? }
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id, unitType, unitStep, retailCostPerUnit, internalCostFormula, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
    }

    // Build update data
    const updateData: any = {};
    if (unitType !== undefined) updateData.unitType = unitType;
    if (unitStep !== undefined) updateData.unitStep = Number(unitStep);
    if (retailCostPerUnit !== undefined) updateData.retailCostPerUnit = Number(retailCostPerUnit);
    if (internalCostFormula !== undefined) updateData.internalCostFormula = internalCostFormula;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Update entry
    const entry = await prisma.priceBookEntry.update({
      where: { id },
      data: updateData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            clerkId: true,
          },
        },
      },
    });

    return NextResponse.json({ entry });
  } catch (error: any) {
    console.error("[PATCH /api/admin/price-book] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update price book entry" },
      { status: error?.message?.includes("Unauthorized") ? 403 : error?.code === "P2025" ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/admin/price-book
 * Delete a price book entry
 * Body: { id }
 */
export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
    }

    await prisma.priceBookEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Price book entry deleted" });
  } catch (error: any) {
    console.error("[DELETE /api/admin/price-book] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete price book entry" },
      { status: error?.message?.includes("Unauthorized") ? 403 : error?.code === "P2025" ? 404 : 500 }
    );
  }
}

