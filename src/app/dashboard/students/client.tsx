"use client"

import { useTransition } from "react"
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
import { Trash2Icon, UploadIcon } from "lucide-react"
import { bulkDeactivateStudentsAction } from "./actions"

export function StudentsClient({
  data,
  canDeactivate,
}: {
  data: StudentRow[]
  canDeactivate: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

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
        facets={[
          { columnId: "department", label: "Department" },
          { columnId: "year", label: "Year" },
          { columnId: "division", label: "Division" },
        ]}
        searchPlaceholder="Search students..."
        exportConfig={{ filename: "Students", onExport: handleExport }}
        rowId={(s) => s.id}
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
    </>
  )
}
