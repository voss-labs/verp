"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTableView } from "@/components/data-table-view"
import {
  studentsColumns,
  type StudentRow,
} from "@/components/columns/students-columns"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Trash2Icon } from "lucide-react"
import { RecordDrawer } from "@/components/record-drawer"
import { RecordHistory } from "@/components/record-history"
import { bulkDeactivateStudentsAction } from "./actions"

export function StudentsClient({
  data,
  canDeactivate,
  department,
  lastImport,
}: {
  data: StudentRow[]
  canDeactivate: boolean
  department?: string
  lastImport?: { when: string; by: string } | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState<StudentRow | null>(null)

  function deactivate(ids: string[], clear: () => void) {
    start(async () => {
      const res = await bulkDeactivateStudentsAction({ ids })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Deactivated ${res.count} student(s)`)
      clear()
      router.refresh()
    })
  }

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
      {lastImport && (
        <p className="text-muted-foreground pb-2 text-xs">
          Last import: {lastImport.when} by {lastImport.by}
        </p>
      )}

      <DataTableView
        columns={studentsColumns}
        data={data}
        globalSearch
        facets={[
          { columnId: "department", label: "Department" },
          { columnId: "year", label: "Year" },
          { columnId: "division", label: "Division" },
        ]}
        searchPlaceholder="Search students..."
        initialFilters={
          department ? [{ id: "department", value: department }] : undefined
        }
        exportConfig={{ filename: "Students", onExport: handleExport }}
        rowId={(s) => s.id}
        onRowClick={setOpen}
        mobileRow={(s) => ({
          title: `${s.firstName} ${s.lastName}`.trim(),
          subtitle: s.rollNumber,
          meta: [
            { label: "Dept", value: s.department },
            { label: "Year", value: s.year },
            ...(s.division ? [{ label: "Div", value: s.division }] : []),
            {
              label: "Account",
              value: s.authUserId ? "Claimed" : "Unclaimed",
            },
          ],
        })}
        bulkBar={
          canDeactivate
            ? (ids, clear) => (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  className="text-destructive"
                  onClick={() => deactivate(ids, clear)}
                >
                  <Trash2Icon className="mr-1.5 size-3.5" />
                  Deactivate
                </Button>
              )
            : undefined
        }
      />

      <RecordDrawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.firstName} ${open.lastName}`.trim() : ""}
        subtitle={open?.email ?? "No email on record"}
        badges={
          open
            ? [
                { label: open.rollNumber },
                ...(open.isActive
                  ? []
                  : [{ label: "Inactive", tone: "critical" as const }]),
                // An unclaimed row is a student who has never signed in, which
                // is the difference between a roster mistake and a person who
                // simply has not arrived yet.
                ...(open.authUserId
                  ? []
                  : [{ label: "Unclaimed", tone: "warn" as const }]),
              ]
            : undefined
        }
        facts={
          open
            ? [
                { label: "Department", value: open.department },
                { label: "Year", value: open.year },
                { label: "Division", value: open.division ?? "—" },
                { label: "Roll number", value: open.rollNumber, mono: true },
              ]
            : undefined
        }
        footer={
          open && (
            <Link
              href={`/dashboard/students/${open.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open full record
            </Link>
          )
        }
      >
        <RecordHistory targetType="student" targetId={open?.id ?? null} />
      </RecordDrawer>
    </>
  )
}
