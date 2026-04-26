"use client"

import { DataTableView } from "@/components/data-table-view"
import {
  coursesColumns,
  type CourseRow,
} from "@/components/columns/courses-columns"

import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"

export function CoursesClient({ data }: { data: CourseRow[] }) {
  const handleExport = async (filteredData: CourseRow[], format: "csv" | "xlsx") => {
    const headers = ["Code", "Course Name", "Type", "Department", "Credits", "ISA", "MSE", "ESE", "Total", "Status"]
    const rows = filteredData.map(c => [
      c.courseCode,
      c.courseName,
      c.courseType,
      c.department?.code ?? "-",
      c.credits,
      c.maxIsa,
      c.maxMse,
      c.maxEse,
      c.maxTotal,
      c.isActive ? "Active" : "Inactive",
    ])

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `Courses_${dateStr}.${format}`

    let base64 = ""
    if (format === "xlsx") {
      base64 = await exportTableXlsx({
        title: "Courses",
        headers,
        rows,
      })
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
      columns={coursesColumns}
      data={data}
      searchKey="courseName"
      searchPlaceholder="Search courses..."
      exportConfig={{
        filename: "Courses",
        onExport: handleExport,
      }}
    />
  )
}
