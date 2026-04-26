"use client"

import { DataTableView } from "@/components/data-table-view"
import {
  studentsColumns,
  type StudentRow,
} from "@/components/columns/students-columns"

import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"

export function StudentsClient({ data }: { data: StudentRow[] }) {
  const handleExport = async (filteredData: StudentRow[], format: "csv" | "xlsx") => {
    const headers = ["Roll No.", "Name", "Email", "Department", "Division", "Year", "Semester", "Phone", "Gender", "Status"]
    const rows = filteredData.map(s => [
      s.rollNumber,
      `${s.firstName} ${s.lastName}`,
      s.email,
      s.department,
      s.division ?? "-",
      s.year,
      s.semester ?? "-",
      s.phoneNo ?? "-",
      s.gender ?? "-",
      s.isActive ? "Active" : "Inactive"
    ])

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `Students_${dateStr}.${format}`

    let base64 = ""
    if (format === "xlsx") {
      base64 = await exportTableXlsx({
        title: "Students",
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
      columns={studentsColumns}
      data={data}
      searchKey="global"
      searchPlaceholder="Search students..."
      exportConfig={{
        filename: "Students",
        onExport: handleExport,
      }}
    />
  )
}
