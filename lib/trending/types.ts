import { z } from "zod";

export const trendingImportMappingSchema = z.object({
  tiktokProductName: z.string(),
  tiktokProductUrl: z.string(),
  rankThisWeek: z.string().optional(),
  tiktokSales7d: z.string().optional(),
  tiktokDailySales: z.string().optional(),
  tiktokPrice: z.string().optional(),
  amazonUrl: z.string().optional(),
  amazonSales7d: z.string().optional(),
  amazonPrice: z.string().optional(),
  amazonTitle: z.string().optional(),
  amazonBrand: z.string().optional(),
  amazonImage: z.string().optional(),
  topVideo1: z.string().optional(),
  topVideo2: z.string().optional(),
  topVideo3: z.string().optional(),
});

export type TrendingImportMapping = z.infer<typeof trendingImportMappingSchema>;

export interface TrendingImportOptions {
  mapping: TrendingImportMapping;
  sheetName: string;
  weekStart: Date;
  weekEnd: Date;
  uploaderId: string;
  fileLabel: string;
}

export interface TrendingImportRow {
  rowNumber: number;
  values: Record<string, unknown>;
}

export interface TrendingImportResult {
  fileLabel: string;
  weekStart: string;
  weekEnd: string;
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
  durationMs: number;
  errors: Array<{
    rowNumber: number;
    tiktokProductName?: string;
    tiktokProductUrl?: string;
    amazonUrl?: string;
    reason: string;
  }>;
  csvIssues?: string;
  mappingTemplate: TrendingImportMapping;
}

