"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DataTableView } from "@/components/data-table-view"
import {
  studentsColumns,
  type StudentRow,
} from "@/components/columns/students-columns"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { UploadIcon, Loader2Icon } from "lucide-react"

/** Shape of one student row parsed from the uploaded file */
type ParsedRow = {
  rollNumber: string
  firstName: string
  lastName: string
  email: string
  department: string
  division?: string
  year: string
  semester?: string
}

/** Error returned by the API for a specific row that failed validation/insert */
type RowError = { row: number; field: string; message: string }

/**
 * Parses a .csv or .xlsx file into an array of ParsedRow objects.
 * Skips the first (header) row in both formats.
 * Uses the native File API for CSV and exceljs (already a project dep) for XLSX.
 */
async function parseFile(file: File): Promise<ParsedRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "csv") {
    const [, ...lines] = (await file.text()).trim().split(/\r?\n/)
    return lines.map((l) => {
      const [
        rollNumber,
        firstName,
        lastName,
        email,
        department,
        division,
        year,
        semester,
      ] = l.split(",").map((v) => v.trim().replace(/^"|"$/g, ""))
      return {
        rollNumber,
        firstName,
        lastName,
        email,
        department,
        division: division || undefined,
        year,
        semester: semester || undefined,
      }
    })
  }
  if (ext === "xlsx" || ext === "xls") {
    const ExcelJS = (await import("exceljs")).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await file.arrayBuffer())
    const rows: ParsedRow[] = []
    wb.worksheets[0].eachRow((row, n) => {
      if (n === 1) return
      const v = row.values as (string | undefined)[]
      rows.push({
        rollNumber: String(v[1] ?? "").trim(),
        firstName: String(v[2] ?? "").trim(),
        lastName: String(v[3] ?? "").trim(),
        email: String(v[4] ?? "").trim(),
        department: String(v[5] ?? "").trim(),
        division: String(v[6] ?? "").trim() || undefined,
        year: String(v[7] ?? "").trim(),
        semester: String(v[8] ?? "").trim() || undefined,
      })
    })
    return rows
  }
  throw new Error("Upload a .csv or .xlsx file.")
}

export function StudentsClient({ data }: { data: StudentRow[] }) {
  const router = useRouter()

  // ── Import dialog state ────────────────────────────────────────────────
  const [open, setOpen] = React.useState(false) // controls dialog visibility
  const [step, setStep] = React.useState<"upload" | "preview" | "result">(
    "upload"
  ) // which dialog screen is active
  const [file, setFile] = React.useState<File | null>(null) // the file the user picked
  const [rows, setRows] = React.useState<ParsedRow[]>([]) // rows parsed from the file
  const [error, setError] = React.useState<string | null>(null) // parse or network error message
  const [loading, setLoading] = React.useState(false) // true while parsing or importing
  const [result, setResult] = React.useState<{
    inserted: number
    errors: RowError[]
  } | null>(null) // API response after import

  /** Resets all import state — called when the dialog closes or the user clicks Done */
  const reset = () => {
    setStep("upload")
    setFile(null)
    setRows([])
    setError(null)
    setResult(null)
  }

  /** Step 1 → 2: parse the selected file and move to the preview step */
  const onPreview = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const parsed = await parseFile(file)
      if (!parsed.length) {
        setError("No data rows found.")
        return
      }
      setRows(parsed)
      setStep("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse.")
    } finally {
      setLoading(false)
    }
  }

  /** Step 2 → 3: POST parsed rows to the API and show the result */
  const onConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Import failed.")
      setResult({
        inserted: json.data?.inserted ?? 0,
        errors: json.data?.errors ?? [],
      })
      setStep("result")
      if (json.data?.inserted > 0) router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.")
      setStep("upload")
    } finally {
      setLoading(false)
    }
  }

  // ── Existing export logic (unchanged) ─────────────────────────────────
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
      "Semester",
      "Phone",
      "Gender",
      "Status",
    ]
    const exportRows = filteredData.map((s) => [
      s.rollNumber,
      `${s.firstName} ${s.lastName}`,
      s.email,
      s.department,
      s.division ?? "-",
      s.year,
      s.semester ?? "-",
      s.phoneNo ?? "-",
      s.gender ?? "-",
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

  const PREVIEW_COLS = [
    "#",
    "Roll No.",
    "First",
    "Last",
    "Email",
    "Dept",
    "Div",
    "Year",
    "Sem",
  ]

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset()
          setOpen(o)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {step === "upload" && "Import Students"}
              {step === "preview" && `Preview — ${rows.length} row(s)`}
              {step === "result" && "Import Complete"}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1 — file picker */}
          {step === "upload" && (
            <div className="space-y-3">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  e.target.value = ""
                }}
                className="block w-full cursor-pointer text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={onPreview} disabled={!file || loading}>
                  {loading && (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {loading ? "Parsing…" : "Preview"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2 — preview table of parsed rows before committing */}
          {step === "preview" && (
            <div className="space-y-3">
              <div className="max-h-72 overflow-auto rounded-md border text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {PREVIEW_COLS.map((h) => (
                        <th
                          key={h}
                          className="px-2 py-1.5 text-left font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="even:bg-muted/30">
                        <td className="text-muted-foreground px-2 py-1">
                          {i + 1}
                        </td>
                        <td className="px-2 py-1">{r.rollNumber}</td>
                        <td className="px-2 py-1">{r.firstName}</td>
                        <td className="px-2 py-1">{r.lastName}</td>
                        <td className="px-2 py-1">{r.email}</td>
                        <td className="px-2 py-1">{r.department}</td>
                        <td className="px-2 py-1">{r.division ?? "—"}</td>
                        <td className="px-2 py-1">{r.year}</td>
                        <td className="px-2 py-1">{r.semester ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={onConfirm} disabled={loading}>
                  {loading && (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {loading ? "Importing…" : "Confirm Import"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3 — summary + per-row errors returned by the API */}
          {step === "result" && result && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{result.inserted}</strong> imported.
                {result.errors.length > 0 && (
                  <>
                    {" "}
                    <strong className="text-destructive">
                      {result.errors.length}
                    </strong>{" "}
                    failed.
                  </>
                )}
              </p>
              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-md border text-xs">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {["Row", "Field", "Error"].map((h) => (
                          <th
                            key={h}
                            className="px-2 py-1.5 text-left font-medium"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((e, i) => (
                        <tr key={i} className="even:bg-muted/30">
                          <td className="px-2 py-1">{e.row}</td>
                          <td className="px-2 py-1 font-mono">{e.field}</td>
                          <td className="text-destructive px-2 py-1">
                            {e.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <DialogFooter>
                <Button
                  onClick={() => {
                    reset()
                    setOpen(false)
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex justify-end pb-2">
        <Button
          variant="outline"
          onClick={() => {
            reset()
            setOpen(true)
          }}
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          Import
        </Button>
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
