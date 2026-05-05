"use client"

import { DataTableView } from "@/components/data-table-view"
import {
  facultyColumns,
  type FacultyRow,
} from "@/components/columns/faculty-columns"

import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"

export function FacultyClient({ data }: { data: FacultyRow[] }) {
  const handleExport = async (
    filteredData: FacultyRow[],
    format: "csv" | "xlsx"
  ) => {
    const headers = [
      "Employee ID",
      "First Name",
      "Last Name",
      "Email",
      "Department",
      "Designation",
      "Qualification",
      "Phone",
      "Status",
    ]
    const rows = filteredData.map((f) => [
      f.employeeId,
      f.firstName,
      f.lastName,
      f.email,
      f.department,
      f.designation,
      f.qualification,
      f.phoneNo,
      f.isActive ? "Active" : "Inactive",
    ])

    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `Faculty_${dateStr}.${format}`

    let base64 = ""
    if (format === "xlsx") {
      base64 = await exportTableXlsx({
        title: "Faculty",
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
      columns={facultyColumns}
      data={data}
      globalSearch
      searchPlaceholder="Search faculty..."
      exportConfig={{
        filename: "Faculty",
        onExport: handleExport,
      }}
    />
  )
}
