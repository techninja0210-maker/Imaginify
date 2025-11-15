import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  await requireAdmin();

  const latest = await prisma.trendingImportLog.findFirst({
    where: { notes: { not: Prisma.JsonNull } },
    orderBy: { startedAt: "desc" },
    select: {
      notes: true,
    },
  });

  const mapping = latest?.notes && typeof latest.notes === "object" ? (latest.notes as Record<string, unknown>).mapping : null;

  return NextResponse.json({
    mapping,
  });
}

