import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/subscription-plans
 * List all subscription plans
 */
export async function GET() {
  try {
    await requireAdmin();

    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: [
        { planFamily: "asc" },
        { version: "desc" },
      ],
      include: {
        subscriptions: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    // Add active subscriber count
    const plansWithCounts = plans.map((plan) => ({
      ...plan,
      activeSubscriberCount: plan.subscriptions.filter(
        (sub) => sub.status === "ACTIVE"
      ).length,
      totalSubscriberCount: plan.subscriptions.length,
    }));

    return NextResponse.json({ success: true, plans: plansWithCounts });
  } catch (error: any) {
    console.error("[GET /api/admin/subscription-plans] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch subscription plans",
      },
      { status: error?.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

/**
 * POST /api/admin/subscription-plans
 * Create a new subscription plan
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const {
      planFamily,
      version,
      internalId,
      publicName,
      priceUsd,
      creditsPerCycle,
      creditExpiryDays,
      stripePriceId,
      stripeProductId,
      isActiveForNewSignups,
      isLegacyOnly,
      isHidden,
      isDefaultForSignup,
      upgradeAllowedTo,
      downgradeAllowedTo,
    } = body;

    // Validation
    if (
      !planFamily ||
      !internalId ||
      !publicName ||
      priceUsd === undefined ||
      creditsPerCycle === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: planFamily, internalId, publicName, priceUsd, creditsPerCycle",
        },
        { status: 400 }
      );
    }

    // Check if internalId already exists
    const existing = await prisma.subscriptionPlan.findUnique({
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
      const existingPrice = await prisma.subscriptionPlan.findUnique({
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
    const plan = await prisma.subscriptionPlan.create({
      data: {
        planFamily,
        version: version || 1,
        internalId,
        publicName,
        priceUsd: Number(priceUsd),
        creditsPerCycle: Number(creditsPerCycle),
        creditExpiryDays: creditExpiryDays || 30,
        stripePriceId: stripePriceId || undefined,
        stripeProductId: stripeProductId || undefined,
        isActiveForNewSignups:
          isActiveForNewSignups !== undefined
            ? Boolean(isActiveForNewSignups)
            : true,
        isLegacyOnly: isLegacyOnly !== undefined ? Boolean(isLegacyOnly) : false,
        isHidden: isHidden !== undefined ? Boolean(isHidden) : false,
        isDefaultForSignup:
          isDefaultForSignup !== undefined ? Boolean(isDefaultForSignup) : false,
        upgradeAllowedTo: upgradeAllowedTo || [],
        downgradeAllowedTo: downgradeAllowedTo || [],
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/admin/subscription-plans] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to create subscription plan",
      },
      { status: error?.message?.includes("Unauthorized") ? 403 : 500 }
    );
  }
}

/**
 * PATCH /api/admin/subscription-plans
 * Update an existing subscription plan
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

    // Check if plan has active subscribers (warn if updating critical fields)
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    const hasActiveSubscribers = plan.subscriptions.length > 0;

    // Warn if updating critical fields with active subscribers
    const criticalFields = [
      "creditsPerCycle",
      "priceUsd",
      "creditExpiryDays",
    ];
    const updatingCritical = criticalFields.some(
      (field) => updateData[field] !== undefined
    );

    if (hasActiveSubscribers && updatingCritical) {
      // Allow update but log warning
      console.warn(
        `[PATCH /api/admin/subscription-plans] Updating critical fields for plan with ${plan.subscriptions.length} active subscribers`
      );
    }

    // Build update data
    const data: any = {};
    if (updateData.publicName !== undefined) data.publicName = updateData.publicName;
    if (updateData.priceUsd !== undefined) data.priceUsd = Number(updateData.priceUsd);
    if (updateData.creditsPerCycle !== undefined)
      data.creditsPerCycle = Number(updateData.creditsPerCycle);
    if (updateData.creditExpiryDays !== undefined)
      data.creditExpiryDays = Number(updateData.creditExpiryDays);
    if (updateData.stripePriceId !== undefined)
      data.stripePriceId = updateData.stripePriceId || null;
    if (updateData.stripeProductId !== undefined)
      data.stripeProductId = updateData.stripeProductId || null;
    if (updateData.isActiveForNewSignups !== undefined)
      data.isActiveForNewSignups = Boolean(updateData.isActiveForNewSignups);
    if (updateData.isLegacyOnly !== undefined)
      data.isLegacyOnly = Boolean(updateData.isLegacyOnly);
    if (updateData.isHidden !== undefined) data.isHidden = Boolean(updateData.isHidden);
    if (updateData.isDefaultForSignup !== undefined)
      data.isDefaultForSignup = Boolean(updateData.isDefaultForSignup);
    if (updateData.upgradeAllowedTo !== undefined)
      data.upgradeAllowedTo = updateData.upgradeAllowedTo;
    if (updateData.downgradeAllowedTo !== undefined)
      data.downgradeAllowedTo = updateData.downgradeAllowedTo;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update plan
    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      plan: updated,
      warning: hasActiveSubscribers && updatingCritical
        ? "Plan has active subscribers. Changes may affect existing users."
        : undefined,
    });
  } catch (error: any) {
    console.error("[PATCH /api/admin/subscription-plans] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to update subscription plan",
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
 * DELETE /api/admin/subscription-plans
 * Delete a subscription plan (only if no active subscribers)
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

    // Check if plan has active subscribers
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: { status: "ACTIVE" },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    if (plan.subscriptions.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete plan with ${plan.subscriptions.length} active subscriber(s). Mark as legacy or hidden instead.`,
        },
        { status: 409 }
      );
    }

    // Delete plan
    await prisma.subscriptionPlan.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription plan deleted",
    });
  } catch (error: any) {
    console.error("[DELETE /api/admin/subscription-plans] Error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to delete subscription plan",
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

