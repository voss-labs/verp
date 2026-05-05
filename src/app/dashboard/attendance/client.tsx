"use client"

import { DataTableView } from "@/components/data-table-view"
import {
  attendanceColumns,
  type AttendanceRow,
} from "@/components/columns/attendance-columns"

import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"

export function AttendanceClient({ data }: { data: AttendanceRow[] }) {
  const handleExport = async (
    filteredData: AttendanceRow[],
    format: "csv" | "xlsx"
  ) => {
    const headers = [
      "Date",
      "Student",
      "Roll No.",
      "Course",
      "Status",
      "Remarks",
    ]
    const rows = filteredData.map((a) => [
      new Date(a.date).toLocaleDateString(),
      a.student ? `${a.student.firstName} ${a.student.lastName}` : "-",
      a.student?.rollNumber ?? "-",
      a.course ? `${a.course.courseCode} - ${a.course.courseName}` : "-",
      a.status.charAt(0).toUpperCase() + a.status.slice(1),
      a.remarks ?? "-",
    ])

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `Attendance_${dateStr}.${format}`

    let base64 = ""
    if (format === "xlsx") {
      base64 = await exportTableXlsx({ title: "Attendance", headers, rows })
      downloadBase64File(
        base64,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    } else {
      base64 = await exportTableCsv({ headers, rows })
      downloadBase64File(base64, filename, "text/csv")
    }
  }

  return (
    <DataTableView
      columns={attendanceColumns}
      data={data}
      globalSearch
      searchPlaceholder="Search attendance..."
      exportConfig={{
        filename: "Attendance",
        onExport: handleExport,
      }}
    />
  )
}
