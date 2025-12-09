"use client"

import { format } from "date-fns"
import { ChevronDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WeeklyReport {
  id: string
  value: string
  label: string
  weekStart: string | Date
  weekEnd: string | Date
}

interface DateRangeSelectorProps {
  reports: WeeklyReport[]
  selectedReportId: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function DateRangeSelector({
  reports,
  selectedReportId,
  onValueChange,
  placeholder = "Select date range",
  className = "",
}: DateRangeSelectorProps) {

  return (
    <Select
      value={selectedReportId && selectedReportId.trim() !== "" ? selectedReportId : undefined}
      onValueChange={(value) => {
        if (value && value.trim() !== "") {
          onValueChange(value)
        }
      }}
    >
      <SelectTrigger
        className={`h-9 bg-gray-100 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-900 hover:bg-gray-200 hover:border-gray-400 transition-colors outline-none focus:outline-none focus:ring-0 focus:visible:ring-0 [&>*:last-child]:hidden ${className}`}
      >
        <SelectValue placeholder={placeholder} />
        <ChevronDown className="h-4 w-4 text-gray-900 ml-2 shrink-0 pointer-events-none" />
      </SelectTrigger>
      <SelectContent className="rounded-xl border border-gray-200 bg-white shadow-lg mt-1 z-[100000]">
        {reports
          .filter((report) => report.id && report.id.trim() !== "")
          .map((report) => {
            // Format each option's display text
            let optionText = report.label
            try {
              const startDate = typeof report.weekStart === "string" 
                ? new Date(report.weekStart) 
                : report.weekStart
              const endDate = typeof report.weekEnd === "string" 
                ? new Date(report.weekEnd) 
                : report.weekEnd

              const startMonth = format(startDate, "MMM")
              const startDay = format(startDate, "d")
              const endMonth = format(endDate, "MMM")
              const endDay = format(endDate, "d")

              if (startMonth === endMonth) {
                optionText = `${startMonth} ${startDay} - ${endDay}`
              } else {
                optionText = `${startMonth} ${startDay} - ${endMonth} ${endDay}`
              }
            } catch (error) {
              // Fallback to label if date parsing fails
            }

            return (
              <SelectItem key={report.id} value={report.id}>
                {optionText}
              </SelectItem>
            )
          })}
      </SelectContent>
    </Select>
  )
}

