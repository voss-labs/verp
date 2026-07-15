"use client"

import { DataTableView } from "@/components/data-table-view"
import {
  studentsColumns,
  type StudentRow,
} from "@/components/columns/students-columns"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { UploadIcon } from "lucide-react"

export function StudentsClient({ data }: { data: StudentRow[] }) {
  const handleExport = async (
    filteredData: StudentRow[],
    format: "csv" | "xlsx"
  ) => {
    const headers = [
      "Roll No.",
      "Name",
      "Email",
      "Department",
      "Division",
      "Year",
      "Claimed",
      "Status",
    ]
    const exportRows = filteredData.map((s) => [
      s.rollNumber,
      `${s.firstName} ${s.lastName}`.trim(),
      s.email ?? "-",
      s.department,
      s.division ?? "-",
      s.year,
      s.authUserId ? "Yes" : "No",
      s.isActive ? "Active" : "Inactive",
    ])
    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `Students_${dateStr}.${format}`
    if (format === "xlsx") {
      const base64 = await exportTableXlsx({
        title: "Students",
        headers,
        rows: exportRows,
      })
      downloadBase64File(
        base64,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    } else {
      const base64 = await exportTableCsv({ headers, rows: exportRows })
      downloadBase64File(base64, filename, "text/csv")
    }
  }

  return (
    <>
      <div className="flex justify-end pb-2">
        <Link
          href="/dashboard/students/import"
          className={buttonVariants({ variant: "outline" })}
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          Import roster
        </Link>
      </div>

      <DataTableView
        columns={studentsColumns}
        data={data}
        globalSearch
        searchPlaceholder="Search students..."
        exportConfig={{ filename: "Students", onExport: handleExport }}
      />
    </>
  )
}
