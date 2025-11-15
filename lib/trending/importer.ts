import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { trendingImportMappingSchema, TrendingImportOptions, TrendingImportResult } from "./types";
import {
  extractAmazonAsin,
  extractTikTokProductId,
  normalizeAmazonUrl,
  parseNumber,
  parsePriceToCents,
  nameOverlapRatio,
  priceGapRatio,
  selectDisplayImage,
  toIsoDate,
} from "./utils";
import { prisma } from "@/lib/database/prisma";

interface ImportCounters {
  rowsProcessed: number;
  rowsCreated: number;
  rowsUpdated: number;
  rowsSkipped: number;
  amazonUrlsTotal: number;
  amazonDotCom: number;
  reviewNeeded: number;
  imageSources: {
    amazon: number;
    tiktok: number;
    placeholder: number;
  };
}

const MAX_ROWS = 2000;

function ensureRowLimit(rows: unknown[]): void {
  if (rows.length > MAX_ROWS) {
    throw new Error(`Import exceeds ${MAX_ROWS} rows (received ${rows.length}).`);
  }
}

function parseWorkbook(buffer: Buffer | ArrayBuffer, sheetName: string) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error("No worksheet found in spreadsheet.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });
  ensureRowLimit(rows);
  return rows;
}

function calculateConfidence({
  tiktokName,
  amazonTitle,
  tiktokPriceCents,
  amazonPriceCents,
}: {
  tiktokName?: string;
  amazonTitle?: string | null;
  tiktokPriceCents?: number | null;
  amazonPriceCents?: number | null;
}) {
  let confidence = 0.5;
  const nameOverlap = nameOverlapRatio(tiktokName, amazonTitle);
  const priceGap = priceGapRatio(tiktokPriceCents, amazonPriceCents);

  if ((nameOverlap !== null && nameOverlap < 0.3) || (priceGap !== null && priceGap > 0.5)) {
    confidence = 0.3;
  }

  return { confidence, nameOverlap, priceGap };
}

export async function importTrendingProducts({
  mapping,
  sheetName,
  weekStart,
  weekEnd,
  uploaderId,
  fileLabel,
}: TrendingImportOptions, fileBuffer: Buffer | ArrayBuffer): Promise<TrendingImportResult> {
  const mappingResult = trendingImportMappingSchema.safeParse(mapping);
  if (!mappingResult.success) {
    throw new Error("Invalid column mapping supplied.");
  }

  const rows = parseWorkbook(fileBuffer, sheetName);
  const counters: ImportCounters = {
    rowsProcessed: 0,
    rowsCreated: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    amazonUrlsTotal: 0,
    amazonDotCom: 0,
    reviewNeeded: 0,
    imageSources: { amazon: 0, tiktok: 0, placeholder: 0 },
  };

  const errors: TrendingImportResult["errors"] = [];
  const startedAt = Date.now();

  const log = await prisma.trendingImportLog.create({
    data: {
      fileLabel,
      uploaderId,
      status: "PROCESSING",
      startedAt: new Date(),
      notes: { mapping },
    },
  });

  let reportId: string | undefined;

  try {
    const report = await prisma.weeklyReport.upsert({
      where: {
        weekStartDate_weekEndDate: {
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
        },
      },
      update: {
        label: `${sheetName || "Weekly Import"} (${toIsoDate(weekStart)} → ${toIsoDate(weekEnd)})`,
      },
      create: {
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        label: sheetName || `${toIsoDate(weekStart)} - ${toIsoDate(weekEnd)}`,
      },
    });

    reportId = report.id;

    await prisma.trendingImportLog.update({
      where: { id: log.id },
      data: {
        status: "PROCESSING",
        reportId,
      },
    });

    for (let index = 0; index < rows.length; index += 1) {
      counters.rowsProcessed += 1;
      const rowNumber = index + 2; // account for header row
      const row = rows[index];

      const tiktokProductUrl = String(row[mapping.tiktokProductUrl] ?? "").trim();
      const tiktokProductName = String(row[mapping.tiktokProductName] ?? "").trim();
      const tiktokProductId = extractTikTokProductId(tiktokProductUrl);

      if (!tiktokProductId) {
        counters.rowsSkipped += 1;
        errors.push({
          rowNumber,
          tiktokProductName,
          tiktokProductUrl,
          reason: "Missing or invalid TikTok product ID",
        });
        continue;
      }

      const rankThisWeekRaw = mapping.rankThisWeek ? parseNumber(row[mapping.rankThisWeek]) : null;
      const rankThisWeek = rankThisWeekRaw != null ? Math.round(rankThisWeekRaw) : null;
      const tiktokSales7d = mapping.tiktokSales7d ? parseNumber(row[mapping.tiktokSales7d]) : null;
      const tiktokDailySales = mapping.tiktokDailySales ? parseNumber(row[mapping.tiktokDailySales]) : null;
      const amazonUrlRaw = mapping.amazonUrl ? String(row[mapping.amazonUrl] ?? "").trim() : "";
      const amazonPriceCents = mapping.amazonPrice ? parsePriceToCents(row[mapping.amazonPrice]) : null;
      const tiktokPriceCents = mapping.tiktokPrice ? parsePriceToCents(row[mapping.tiktokPrice]) : null;
      const amazonSales7d = mapping.amazonSales7d ? parseNumber(row[mapping.amazonSales7d]) : null;
      const amazonTitle = mapping.amazonTitle ? String(row[mapping.amazonTitle] ?? "").trim() || null : null;
      const amazonBrand = mapping.amazonBrand ? String(row[mapping.amazonBrand] ?? "").trim() || null : null;
      const amazonImage = mapping.amazonImage ? String(row[mapping.amazonImage] ?? "").trim() || null : null;

      const topVideoUrls = [
        mapping.topVideo1 ? String(row[mapping.topVideo1] ?? "").trim() : "",
        mapping.topVideo2 ? String(row[mapping.topVideo2] ?? "").trim() : "",
        mapping.topVideo3 ? String(row[mapping.topVideo3] ?? "").trim() : "",
      ].filter(Boolean);

      let amazonAsin: string | null = null;
      let amazonCanonicalUrl: string | null = null;

      if (amazonUrlRaw) {
        counters.amazonUrlsTotal += 1;
        amazonAsin = extractAmazonAsin(amazonUrlRaw);
        if (!amazonAsin) {
          counters.rowsSkipped += 1;
          errors.push({
            rowNumber,
            tiktokProductName,
            tiktokProductUrl,
            amazonUrl: amazonUrlRaw,
            reason: "Invalid Amazon .com URL or ASIN",
          });
          continue;
        }
        amazonCanonicalUrl = normalizeAmazonUrl(amazonAsin);
        counters.amazonDotCom += 1;
      }

      const { confidence } = calculateConfidence({
        tiktokName: tiktokProductName,
        amazonTitle,
        tiktokPriceCents,
        amazonPriceCents,
      });

      const existingProduct = await prisma.trendingProduct.findUnique({
        where: { tiktokProductId },
      });

      const imageSelection = selectDisplayImage({
        currentUrl: existingProduct?.displayImageUrl,
        amazonImageUrl: amazonImage || undefined,
        tiktokThumbnailUrl: topVideoUrls.length ? `${topVideoUrls[0]}#thumbnail` : undefined,
      });

      counters.imageSources[imageSelection.source] += 1;

      let productId: string;
      if (existingProduct) {
        const updateData: Prisma.TrendingProductUpdateInput = {
          tiktokProductUrl,
          displayImageUrl: imageSelection.url,
        };

        if (tiktokProductName) {
          updateData.name = tiktokProductName;
        }

        const updated = await prisma.trendingProduct.update({
          where: { id: existingProduct.id },
          data: updateData,
        });
        productId = updated.id;
        counters.rowsUpdated += 1;
      } else {
        const created = await prisma.trendingProduct.create({
          data: {
            tiktokProductId,
            name: tiktokProductName || "Untitled Product",
            tiktokProductUrl,
            displayImageUrl: imageSelection.url,
          },
        });
        productId = created.id;
        counters.rowsCreated += 1;
      }

      await prisma.productWeekStat.upsert({
        where: {
          reportId_productId: {
            reportId: report.id,
            productId,
          },
        },
        update: {
          rankThisWeek: rankThisWeek ?? undefined,
          tiktokSales7d: tiktokSales7d,
          tiktokDailySales: tiktokDailySales,
          amazonSales7d: amazonSales7d,
          snapshotPriceCents: tiktokPriceCents ?? amazonPriceCents ?? null,
        },
        create: {
          reportId: report.id,
          productId,
          rankThisWeek: rankThisWeek ?? undefined,
          tiktokSales7d: tiktokSales7d,
          tiktokDailySales: tiktokDailySales,
          amazonSales7d: amazonSales7d,
          snapshotPriceCents: tiktokPriceCents ?? amazonPriceCents ?? null,
        },
      });

      if (amazonAsin && amazonCanonicalUrl) {
        await prisma.amazonProduct.upsert({
          where: { asin: amazonAsin },
          update: {
            canonicalUrl: amazonCanonicalUrl,
            title: amazonTitle,
            brand: amazonBrand,
            mainImageUrl: amazonImage,
          },
          create: {
            asin: amazonAsin,
            canonicalUrl: amazonCanonicalUrl,
            title: amazonTitle,
            brand: amazonBrand,
            mainImageUrl: amazonImage,
          },
        });

        await prisma.productAmazonMatch.upsert({
          where: {
            productId_asin: {
              productId,
              asin: amazonAsin,
            },
          },
          update: {
            confidence,
            source: "kalodata",
            method: "spreadsheet-import",
            chosen: confidence >= 0.5,
          },
          create: {
            productId,
            asin: amazonAsin,
            confidence,
            source: "kalodata",
            method: "spreadsheet-import",
            chosen: confidence >= 0.5,
          },
        });

        if (confidence < 0.5) {
          counters.reviewNeeded += 1;
        }
      }

      if (topVideoUrls.length) {
        await prisma.$transaction(
          topVideoUrls.map((url, idx) =>
            prisma.trendingVideo.upsert({
              where: { url },
              update: { productId, rankForProduct: idx + 1 },
              create: {
                url,
                productId,
                rankForProduct: idx + 1,
              },
            })
          )
        );
      }
    }

    const durationMs = Date.now() - startedAt;

    await prisma.trendingImportLog.update({
      where: { id: log.id },
      data: {
        status: "COMPLETED",
        rowsProcessed: counters.rowsProcessed,
        rowsCreated: counters.rowsCreated,
        rowsUpdated: counters.rowsUpdated,
        rowsSkipped: counters.rowsSkipped,
        rowsFlagged: counters.reviewNeeded,
        notes: {
          mapping,
          errors,
        },
        completedAt: new Date(),
        reportId,
      },
    });

    const csvHeader = [
      "row_number",
      "tiktok_product_name",
      "tiktok_product_url",
      "amazon_url",
      "reason",
    ];
    const csvBody = errors
      .map((error) =>
        [
          error.rowNumber,
          JSON.stringify(error.tiktokProductName ?? ""),
          JSON.stringify(error.tiktokProductUrl ?? ""),
          JSON.stringify(error.amazonUrl ?? ""),
          JSON.stringify(error.reason),
        ].join(",")
      )
      .join("\n");
    const csv = [csvHeader.join(","), csvBody].filter(Boolean).join("\n");
    const csvBase64 = Buffer.from(csv).toString("base64");

    return {
      fileLabel,
      weekStart: toIsoDate(weekStart),
      weekEnd: toIsoDate(weekEnd),
      rowsProcessed: counters.rowsProcessed,
      rowsCreated: counters.rowsCreated,
      rowsUpdated: counters.rowsUpdated,
      rowsSkipped: counters.rowsSkipped,
      amazonUrlsTotal: counters.amazonUrlsTotal,
      amazonDotCom: counters.amazonDotCom,
      reviewNeeded: counters.reviewNeeded,
      imageSources: counters.imageSources,
      durationMs,
      errors,
      csvIssues: `data:text/csv;base64,${csvBase64}`,
      mappingTemplate: mapping,
    };
  } catch (error) {
    await prisma.trendingImportLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        rowsProcessed: counters.rowsProcessed,
        rowsCreated: counters.rowsCreated,
        rowsUpdated: counters.rowsUpdated,
        rowsSkipped: counters.rowsSkipped,
        rowsFlagged: counters.reviewNeeded,
        notes: {
          mapping,
          errors,
          message: error instanceof Error ? error.message : String(error),
        },
        completedAt: new Date(),
        reportId,
      },
    });
    throw error;
  }
}

