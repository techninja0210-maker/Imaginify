import { NextResponse } from "next/server";
import { format } from "date-fns";
import { put, del } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { importTrendingProducts } from "@/lib/trending/importer";
import { trendingImportMappingSchema } from "@/lib/trending/types";
import { prisma } from "@/lib/database/prisma";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ACCEPTED_TYPES = ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

function parseDateOrThrow(value: string | null, fallback?: Date): Date {
  if (value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid date supplied: ${value}`);
    }
    return date;
  }
  if (!fallback) {
    throw new Error("weekEnd date is required.");
  }
  return fallback;
}

export async function POST(request: Request) {
  const currentUser = await requireAdmin();

  const activeImport = await prisma.trendingImportLog.findFirst({
    where: { status: "PROCESSING" },
  });
  if (activeImport) {
    return NextResponse.json(
      { error: "Another import is in progress. Please wait until it finishes." },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const mappingRaw = formData.get("mapping");
  const sheetName = String(formData.get("sheetName") || "");
  const weekEndInput = (formData.get("weekEnd") as string | null) ?? null;
  const weekStartInput = (formData.get("weekStart") as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (!mappingRaw || typeof mappingRaw !== "string") {
    return NextResponse.json({ error: "Mapping configuration is required." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds the 25 MB limit." },
      { status: 400 }
    );
  }

  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  if (!ACCEPTED_TYPES.includes(file.type) && (!fileExtension || !["csv", "xls", "xlsx"].includes(fileExtension))) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload CSV or Excel spreadsheets." },
      { status: 400 }
    );
  }

  const mappingResult = trendingImportMappingSchema.safeParse(JSON.parse(mappingRaw));
  if (!mappingResult.success) {
    return NextResponse.json({ error: "Invalid column mapping supplied." }, { status: 400 });
  }

  const envSlug = process.env.VERCEL_ENV || process.env.NODE_ENV || "local";
  const todaysFolder = format(new Date(), "yyyy-MM-dd");
  const objectPath = `sv-imports/${envSlug}/${todaysFolder}/${Date.now()}-${currentUser.id}-${file.name}`;

  const uploadBuffer = Buffer.from(await file.arrayBuffer());

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return NextResponse.json(
      {
        error: "Missing Blob token. Set BLOB_READ_WRITE_TOKEN in your environment or provide a token option.",
      },
      { status: 500 }
    );
  }

  const blob = await put(objectPath, uploadBuffer, {
    access: "public",
    contentType: file.type || "application/octet-stream",
    token: blobToken,
  });

  const weekEnd = parseDateOrThrow(weekEndInput);
  const computedWeekStart = new Date(weekEnd);
  computedWeekStart.setDate(computedWeekStart.getDate() - 6);
  const weekStart = parseDateOrThrow(weekStartInput, computedWeekStart);

  try {
    const authToken = process.env.BLOB_READ_WRITE_TOKEN;
    const blobResponse = await fetch(blob.url, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });
    if (!blobResponse.ok) {
      throw new Error(`Unable to read uploaded blob (${blobResponse.status})`);
    }
    const workbookBuffer = await blobResponse.arrayBuffer();

    const result = await importTrendingProducts(
      {
        mapping: mappingResult.data,
        sheetName,
        weekStart,
        weekEnd,
        uploaderId: currentUser.id,
        fileLabel: file.name,
      },
      Buffer.from(workbookBuffer)
    );

    await del(blob.url);

    return NextResponse.json({ success: true, summary: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed unexpectedly." },
      { status: 500 }
    );
  }
}

