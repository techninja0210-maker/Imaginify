import { NextResponse } from "next/server"
import { getWeeklyReports, getLatestWeeklyReport } from "@/lib/actions/trending.actions"

export const dynamic = "force-dynamic"

// GET /api/trending/reports
export async function GET() {
  try {
    const reports = await getWeeklyReports()
    const latest = await getLatestWeeklyReport()

    return NextResponse.json({
      success: true,
      reports: reports.map(report => ({
        ...report,
        weekStart: report.weekStart instanceof Date ? report.weekStart.toISOString() : report.weekStart,
        weekEnd: report.weekEnd instanceof Date ? report.weekEnd.toISOString() : report.weekEnd,
      })),
      latest: latest
        ? {
            id: latest.id,
            value: latest.id,
            label: latest.label || formatDateRange(latest.weekStartDate, latest.weekEndDate),
            weekStart: latest.weekStartDate instanceof Date ? latest.weekStartDate.toISOString() : latest.weekStartDate,
            weekEnd: latest.weekEndDate instanceof Date ? latest.weekEndDate.toISOString() : latest.weekEndDate,
          }
        : null,
    })
  } catch (error) {
    console.error("Error fetching weekly reports:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch weekly reports",
      },
      { status: 500 }
    )
  }
}

function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-US", { month: "short" })
  const startDay = start.getDate()
  const endMonth = end.toLocaleDateString("en-US", { month: "short" })
  const endDay = end.getDate()
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`
}

