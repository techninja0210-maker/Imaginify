"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { format, parse } from "date-fns";
import { TrendingImportMapping } from "@/lib/trending/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

type MappingKey = keyof TrendingImportMapping;

interface MappingField {
  key: MappingKey;
  label: string;
  required?: boolean;
}

const MAPPING_FIELDS: MappingField[] = [
  { key: "tiktokProductName", label: "TikTok Product Name", required: true },
  { key: "tiktokProductUrl", label: "TikTok Product URL", required: true },
  { key: "rankThisWeek", label: "Rank This Week" },
  { key: "tiktokSales7d", label: "TikTok 7 Day Sales" },
  { key: "tiktokDailySales", label: "TikTok Daily Sales" },
  { key: "tiktokPrice", label: "TikTok Price" },
  { key: "amazonUrl", label: "Amazon URL" },
  { key: "amazonSales7d", label: "Amazon Sales (7d)" },
  { key: "amazonPrice", label: "Amazon Price" },
  { key: "amazonTitle", label: "Amazon Title" },
  { key: "amazonBrand", label: "Amazon Brand" },
  { key: "amazonImage", label: "Amazon Image URL" },
  { key: "topVideo1", label: "Top #1 Video URL" },
  { key: "topVideo2", label: "Top #2 Video URL" },
  { key: "topVideo3", label: "Top #3 Video URL" },
];

interface SummaryState {
  success: boolean;
  summary: {
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
    csvIssues?: string;
  } | null;
}

const LOCAL_STORAGE_KEY = "sv-trending-import-mapping";

const DEFAULT_MAPPING: TrendingImportMapping = {
  tiktokProductName: "",
  tiktokProductUrl: "",
};

function inferDateFromSheet(sheetName: string): string {
  if (!sheetName) return "";
  const trimmed = sheetName.trim();
  const parsedExact = parse(trimmed, "MMMM d, yyyy", new Date());
  if (!Number.isNaN(parsedExact.getTime())) {
    return format(parsedExact, "yyyy-MM-dd");
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    return format(new Date(timestamp), "yyyy-MM-dd");
  }
  return "";
}

export function TrendingImportContent() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<TrendingImportMapping>(DEFAULT_MAPPING);
  const [weekEnd, setWeekEnd] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState<SummaryState>({ success: false, summary: null });
  const { toast } = useToast();

  const [detectedMapping, setDetectedMapping] = useState<TrendingImportMapping | null>(null);

  const columnOptions = useMemo(() => {
    return ["__none__", ...columns];
  }, [columns]);

  useEffect(() => {
    async function hydrateTemplate() {
      try {
        const response = await fetch("/api/admin/trending/last-template");
        if (!response.ok) return;
        const data = (await response.json()) as { mapping?: TrendingImportMapping | null };
        if (data.mapping) {
          setDetectedMapping(data.mapping);
        }
      } catch {
        // ignore
      }
    }
    hydrateTemplate();
  }, []);

  useEffect(() => {
    if (!columns.length) return;
    const storedMappingRaw = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
    const storedMapping = storedMappingRaw ? (JSON.parse(storedMappingRaw) as TrendingImportMapping) : null;
    const template = detectedMapping || storedMapping;

    const nextMapping: TrendingImportMapping = {
      ...DEFAULT_MAPPING,
    };

    for (const field of MAPPING_FIELDS) {
      const preferred =
        template?.[field.key] && columns.includes(template[field.key] as string)
          ? (template[field.key] as string)
          : autoDetectColumn(field.key, columns);
      if (preferred) {
        nextMapping[field.key] = preferred;
      }
    }

    setMapping(nextMapping);
  }, [columns, detectedMapping]);

  useEffect(() => {
    if (!weekEnd && selectedSheet) {
      const inferred = inferDateFromSheet(selectedSheet);
      if (inferred) {
        setWeekEnd(inferred);
        const inferredStart = new Date(inferred);
        inferredStart.setDate(inferredStart.getDate() - 6);
        setWeekStart(format(inferredStart, "yyyy-MM-dd"));
      }
    }
  }, [selectedSheet, weekEnd]);

  function autoDetectColumn(key: MappingKey, available: string[]): string {
    const normalized = available.map((col) => col.trim().toLowerCase());
    const find = (keywords: string[]) => {
      for (const keyword of keywords) {
        const idx = normalized.findIndex((col) => col.includes(keyword));
        if (idx >= 0) return available[idx];
      }
      return "";
    };

    switch (key) {
      case "tiktokProductName":
        return find(["tiktok product name", "product"]);
      case "tiktokProductUrl":
        return find(["tiktok product url", "tiktok url"]);
      case "rankThisWeek":
        return find(["rank"]);
      case "tiktokSales7d":
        return find(["tiktok 7 day sales", "7 day"]);
      case "tiktokDailySales":
        return find(["daily sales"]);
      case "tiktokPrice":
        return find(["tiktok price"]);
      case "amazonUrl":
        return find(["amazon url", "amazon link"]);
      case "amazonSales7d":
        return find(["amazon sales"]);
      case "amazonPrice":
        return find(["amazon price"]);
      case "amazonTitle":
        return find(["amazon title"]);
      case "amazonBrand":
        return find(["amazon brand"]);
      case "amazonImage":
        return find(["amazon image"]);
      case "topVideo1":
        return find(["top #1", "top 1"]);
      case "topVideo2":
        return find(["top #2", "top 2"]);
      case "topVideo3":
        return find(["top #3", "top 3"]);
      default:
        return "";
    }
  }

  function handleFileChange(selected: File | null) {
    setSummary({ success: false, summary: null });
    if (!selected) {
      setFile(null);
      setSheetNames([]);
      setSelectedSheet("");
      setColumns([]);
      setPreviewRows([]);
      return;
    }

    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      toast({
        title: "Unsupported file format",
        description: "Please upload a CSV or Excel (.xlsx) file.",
        variant: "destructive",
      });
      return;
    }

    setFile(selected);

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: "array" });
      setSheetNames(workbook.SheetNames);
      const defaultSheet = workbook.SheetNames[0];
      setSelectedSheet(defaultSheet);
      hydrateSheetData(workbook, defaultSheet);
    };
    reader.readAsArrayBuffer(selected);
  }

  function hydrateSheetData(workbook: XLSX.WorkBook, sheet: string) {
    const worksheet = workbook.Sheets[sheet];
    if (!worksheet) return;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });
    if (rows.length === 0) {
      setColumns([]);
      setPreviewRows([]);
      return;
    }
    const columns = Object.keys(rows[0]);
    setColumns(columns);
    setPreviewRows(rows.slice(0, 5));
  }

  function handleSheetChange(value: string) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: "array" });
      setSelectedSheet(value);
      hydrateSheetData(workbook, value);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleMappingChange(key: MappingKey, value: string) {
    setMapping((prev) => ({
      ...prev,
      [key]: value === "__none__" ? "" : value,
    }));
  }

  async function handleSubmit() {
    if (!file) {
      toast({ title: "Please choose a file before importing.", variant: "destructive" });
      return;
    }

    const missingRequired = MAPPING_FIELDS.filter((field) => field.required && !mapping[field.key]);
    if (missingRequired.length) {
      toast({
        title: "Missing required columns",
        description: `Please map: ${missingRequired.map((field) => field.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    if (!selectedSheet) {
      toast({ title: "Select a worksheet to import.", variant: "destructive" });
      return;
    }

    if (!weekEnd) {
      toast({ title: "Set the week ending date.", description: "Week end is required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setSummary({ success: false, summary: null });

    try {
      const sanitizedMapping = Object.fromEntries(
        Object.entries(mapping).filter(([, value]) => Boolean(value))
      ) as TrendingImportMapping;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(sanitizedMapping));
      formData.append("sheetName", selectedSheet);
      formData.append("weekEnd", weekEnd);
      if (weekStart) formData.append("weekStart", weekStart);

      const response = await fetch("/api/admin/trending/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Import failed.");
      }

      const payload = (await response.json()) as { success: boolean; summary: SummaryState["summary"] };
      setSummary(payload);
      toast({
        title: "Import completed",
        description: `Processed ${payload.summary?.rowsProcessed ?? 0} rows in ${Math.round(
          (payload.summary?.durationMs ?? 0) / 1000
        )}s.`,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitizedMapping));
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Weekly Trending Import</h2>
            <p className="text-sm text-gray-500">
              Upload the Kalodata (or manual) TikTok ↔ Amazon spreadsheet, map the columns, and generate the weekly report.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-medium text-sm text-gray-700">Spreadsheet File</label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="mt-1"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-gray-500 mt-1">Accepted formats: CSV or Excel (.xlsx). Max 25 MB.</p>
            </div>

            {sheetNames.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="font-medium text-sm text-gray-700">Worksheet</label>
                  <Select value={selectedSheet} onValueChange={handleSheetChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose worksheet" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((sheet) => (
                        <SelectItem key={sheet} value={sheet}>
                          {sheet}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col">
                  <label className="font-medium text-sm text-gray-700">Week Ending (Sunday)</label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={weekEnd}
                    onChange={(event) => {
                      const value = event.target.value;
                      setWeekEnd(value);
                      if (value) {
                        const endDate = new Date(value);
                        const startDate = new Date(endDate);
                        startDate.setDate(endDate.getDate() - 6);
                        setWeekStart(format(startDate, "yyyy-MM-dd"));
                      } else {
                        setWeekStart("");
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Week start auto-calculated (Mon) but editable.</p>
                </div>

                <div className="flex flex-col">
                  <label className="font-medium text-sm text-gray-700">Week Start</label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={weekStart}
                    onChange={(event) => setWeekStart(event.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {columns.length > 0 && (
        <section className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Column Mapping</h3>
            <p className="text-sm text-gray-500">Match each field to the column header detected in your file.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {MAPPING_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 flex items-center justify-between">
                  {field.label}
                  {field.required && <span className="text-xs text-purple-600 font-semibold">Required</span>}
                </label>
                <Select
                  value={mapping[field.key] || "__none__"}
                  onValueChange={(value) => handleMappingChange(field.key, value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnOptions.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column === "__none__" ? "— Ignore —" : column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </section>
      )}

      {previewRows.length > 0 && (
        <section className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Preview (first 5 rows)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-2 font-medium text-gray-700">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={index} className="border-t border-gray-100">
                    {columns.map((column) => (
                      <td key={column} className="px-4 py-2 text-gray-600">
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Limits: up to 25 MB • max 2,000 rows • one import at a time • target completion &lt; 2 minutes.
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting || !file}>
          {isSubmitting ? "Importing…" : "Run Import"}
        </Button>
      </div>

      {summary.summary && (
        <section className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Import Summary</h3>
            <p className="text-sm text-gray-500">
              {summary.summary.fileLabel} · Week {summary.summary.weekStart} → {summary.summary.weekEnd}
            </p>
          </div>

          <dl className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-md p-4">
              <dt className="font-medium text-gray-700">Processed</dt>
              <dd className="text-gray-900 text-lg">{summary.summary.rowsProcessed}</dd>
              <p className="text-xs text-gray-500">
                Created {summary.summary.rowsCreated} · Updated {summary.summary.rowsUpdated} · Skipped{" "}
                {summary.summary.rowsSkipped}
              </p>
            </div>
            <div className="bg-gray-50 rounded-md p-4">
              <dt className="font-medium text-gray-700">Amazon Matches</dt>
              <dd className="text-gray-900 text-lg">{summary.summary.amazonDotCom}</dd>
              <p className="text-xs text-gray-500">
                URLs received: {summary.summary.amazonUrlsTotal} · Review needed: {summary.summary.reviewNeeded}
              </p>
            </div>
            <div className="bg-gray-50 rounded-md p-4">
              <dt className="font-medium text-gray-700">Duration</dt>
              <dd className="text-gray-900 text-lg">
                {Math.round(summary.summary.durationMs / 1000)}s
              </dd>
              <p className="text-xs text-gray-500">Image sources: Amazon {summary.summary.imageSources.amazon}, TikTok{" "}
                {summary.summary.imageSources.tiktok}, Placeholder {summary.summary.imageSources.placeholder}</p>
            </div>
          </dl>

          {summary.summary.csvIssues && (
            <div className="flex items-center justify-between border border-gray-200 rounded-md px-4 py-3">
              <div>
                <h4 className="font-medium text-gray-800">Issues CSV</h4>
                <p className="text-xs text-gray-500">Download detailed error log for skipped rows.</p>
              </div>
              <Button variant="outline" asChild>
                <a href={summary.summary.csvIssues} download="import-issues.csv">
                  Download CSV
                </a>
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

