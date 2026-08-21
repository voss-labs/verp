"use client"

import { useState } from "react"
import { DataTableView } from "@/components/data-table-view"
import { RecordDialog } from "@/components/record-dialog"
import { RecordHistory } from "@/components/record-history"
import {
  facultyColumns,
  ROLE_LABEL,
  type FacultyRow,
} from "@/components/columns/faculty-columns"

import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"

export function FacultyClient({ data }: { data: FacultyRow[] }) {
  const [open, setOpen] = useState<FacultyRow | null>(null)

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
      "Role",
      "Status",
    ]
    const rows = filteredData.map((f) => [
      f.employeeId,
      f.firstName,
      f.lastName,
      f.email,
      f.department,
      f.role,
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
    <>
      <DataTableView
        columns={facultyColumns}
        data={data}
        globalSearch
        searchPlaceholder="Search faculty..."
        facets={[
          { columnId: "department", label: "Department" },
          {
            columnId: "role",
            label: "Role",
            format: (v) => ROLE_LABEL[v as FacultyRow["role"]] ?? v,
          },
        ]}
        exportConfig={{
          filename: "Faculty",
          onExport: handleExport,
        }}
        rowId={(f) => f.id}
        onRowClick={setOpen}
        mobileRow={(f) => ({
          title: `${f.firstName} ${f.lastName}`.trim(),
          subtitle: f.email,
          meta: [
            { label: "ID", value: f.employeeId },
            { label: "Dept", value: f.department },
            { label: "Role", value: ROLE_LABEL[f.role] },
          ],
        })}
      />

      <RecordDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.firstName} ${open.lastName}`.trim() : ""}
        subtitle={open?.email}
        badges={
          open
            ? [
                { label: ROLE_LABEL[open.role] },
                ...(open.isActive
                  ? []
                  : [{ label: "Inactive", tone: "critical" as const }]),
              ]
            : undefined
        }
        facts={
          open
            ? [
                { label: "Employee ID", value: open.employeeId, mono: true },
                { label: "Department", value: open.department },
                { label: "Role", value: ROLE_LABEL[open.role] },
                {
                  label: "Status",
                  value: open.isActive ? "Active" : "Inactive",
                },
              ]
            : undefined
        }
      >
        <RecordHistory targetType="faculty" targetId={open?.id ?? null} />
      </RecordDialog>
    </>
  )
}
