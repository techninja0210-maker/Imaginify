import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/database/prisma";
import { requireAdmin } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/price-book
 * List all price book entries
 */
export async function GET() {
  try {
    await requireAdmin();

    const entries = await prisma.priceBookEntry.findMany({
      orderBy: [
        { pipelineKey: "asc" },
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
 * Body: { pipelineKey, creditCost, active }
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const {
      pipelineKey,
      creditCost,
      active,
    } = body;

    // Validation
    if (!pipelineKey || creditCost === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: pipelineKey, creditCost" },
        { status: 400 }
      );
    }

    if (typeof creditCost !== 'number' || creditCost < 0) {
      return NextResponse.json(
        { error: "creditCost must be a non-negative number" },
        { status: 400 }
      );
    }

    // Check if entry already exists
    const existing = await prisma.priceBookEntry.findUnique({
      where: {
        pipelineKey,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Price book entry already exists for pipeline: ${pipelineKey}` },
        { status: 409 }
      );
    }

    // Create entry
    const entry = await prisma.priceBookEntry.create({
      data: {
        pipelineKey,
        creditCost: Number(creditCost),
        active: active !== undefined ? Boolean(active) : true,
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
 * Body: { id, pipelineKey?, creditCost?, active? }
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id, pipelineKey, creditCost, active } = body;

    if (!id) {
      return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
    }

    // Build update data
    const updateData: any = {};
    if (pipelineKey !== undefined) updateData.pipelineKey = pipelineKey;
    if (creditCost !== undefined) {
      if (typeof creditCost !== 'number' || creditCost < 0) {
        return NextResponse.json(
          { error: "creditCost must be a non-negative number" },
          { status: 400 }
        );
      }
      updateData.creditCost = Number(creditCost);
    }
    if (active !== undefined) updateData.active = Boolean(active);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Update entry
    const entry = await prisma.priceBookEntry.update({
      where: { id },
      data: updateData,
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
