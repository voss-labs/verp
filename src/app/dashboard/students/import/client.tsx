"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  UploadCloudIcon,
  FileSpreadsheetIcon,
  CheckCircle2Icon,
  XIcon,
  AlertTriangleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { flagRow, type PreviewRow } from "@/lib/xlsx-import"

// Only the fields VERP does NOT compute. No marks, no CGPA, no attendance.
const COLUMNS: { key: keyof PreviewRow; label: string }[] = [
  { key: "rollNumber", label: "Roll number" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "department", label: "Dept" },
  { key: "division", label: "Div" },
  { key: "year", label: "Year" },
]

type PreviewResponse = {
  sheetNames: string[]
  activeSheet: string
  headerFound: boolean
  headerRow?: number
  rows: PreviewRow[]
  totalRows: number
  flaggedRows: number
  truncated: boolean
}

export function ImportClient() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const file = useRef<File | null>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [rows, setRows] = useState<PreviewRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)

  const flaggedCount = useMemo(
    () => rows?.filter((r) => r.flags.length > 0).length ?? 0,
    [rows]
  )

  // Ask the server to parse a file, optionally targeting a specific sheet. The
  // raw file stays in the browser (file ref) so switching sheets just re-POSTs.
  async function runPreview(f: File, sheet?: string) {
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", f)
      if (sheet) form.append("sheet", sheet)
      const res = await fetch("/api/students/import/preview", {
        method: "POST",
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not read that file")
        return
      }
      const data = json.data as PreviewResponse
      setPreview(data)
      setRows(data.headerFound ? data.rows : null)
      if (data.truncated) {
        toast.warning(`Only the first ${data.rows.length} rows were read.`)
      }
    } catch {
      toast.error("Upload failed. Try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleFile(f: File) {
    file.current = f
    setFileName(f.name)
    setPreview(null)
    setRows(null)
    void runPreview(f)
  }

  function switchSheet(sheet: string | null) {
    if (sheet && file.current) void runPreview(file.current, sheet)
  }

  function reset() {
    file.current = null
    setFileName(null)
    setPreview(null)
    setRows(null)
  }

  // Live re-validation: as the TR fixes a cell, re-run the same flagRow the
  // server used, so red flags clear the instant they're resolved.
  function editCell(index: number, key: keyof PreviewRow, value: string) {
    setRows((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const { flags: _drop, ...fields } = next[index]
      next[index] = flagRow({ ...fields, [key]: value })
      return next
    })
  }

  // Real sheets carry section labels the auto-classifier can't confidently drop
  // ("CLASS", "DSY"). The TR removes those rows here rather than being blocked.
  function removeRow(index: number) {
    setRows((prev) => prev?.filter((_, i) => i !== index) ?? prev)
  }

  async function commit() {
    if (!rows) return
    if (flaggedCount > 0) {
      toast.error(`Resolve ${flaggedCount} flagged row(s) before importing.`)
      return
    }
    setCommitting(true)
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r) => ({
            rollNumber: r.rollNumber,
            firstName: r.firstName,
            lastName: r.lastName || undefined,
            email: r.email || undefined,
            department: r.department,
            division: r.division || undefined,
            year: r.year,
            semester: r.semester || undefined,
            phoneNo: r.phoneNo || undefined,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Import failed")
        return
      }
      const { inserted, failed, errors } = json.data as {
        inserted: number
        failed: number
        errors: { row: number; message: string }[]
      }
      if (failed > 0) {
        toast.warning(`Imported ${inserted}, ${failed} failed.`)
        // Surface DB-level failures (e.g. an already-existing roll number) back
        // onto the rows so the TR can see which.
        setRows((prev) => {
          if (!prev) return prev
          const next = [...prev]
          for (const e of errors) {
            const i = e.row - 1
            if (next[i])
              next[i] = {
                ...next[i],
                flags: [{ field: "rollNumber", message: e.message }],
              }
          }
          return next
        })
      } else {
        toast.success(`Imported ${inserted} students.`)
        router.push("/dashboard/students")
        router.refresh()
      }
    } catch {
      toast.error("Import failed. Try again.")
    } finally {
      setCommitting(false)
    }
  }

  // ── Upload state ──────────────────────────────────────────────────────
  if (!preview) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        className="border-border hover:border-blue/50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-16 text-center transition-colors"
      >
        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <UploadCloudIcon className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          Upload a roster
        </h2>
        <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
          An Excel sheet of students — roll number, name, and whatever columns
          you have. We find the header row, map the columns and check every roll
          number before anything is saved. Marks, SGPI and attendance are never
          imported; VERP owns those.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        <Button
          className="mt-6"
          disabled={loading}
          onClick={() => fileInput.current?.click()}
        >
          {loading ? "Reading…" : "Choose file"}
        </Button>
      </div>
    )
  }

  // ── Sheet picker (shared by the preview and the no-header states) ──────
  const sheetPicker = preview.sheetNames.length > 1 && (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sheet</span>
      <Select
        value={preview.activeSheet}
        onValueChange={switchSheet}
        disabled={loading}
      >
        <SelectTrigger size="sm" className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {preview.sheetNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  // ── No roster header on this sheet ─────────────────────────────────────
  if (!preview.headerFound || !rows) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheetIcon className="text-muted-foreground size-4" />
            <span className="font-medium">{fileName}</span>
          </div>
          <Button variant="outline" size="sm" onClick={reset}>
            Choose another file
          </Button>
        </div>
        <div className="border-border flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
            <AlertTriangleIcon className="size-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold tracking-tight">
            No roster found on &ldquo;{preview.activeSheet}&rdquo;
          </h2>
          <p className="text-muted-foreground mt-1 max-w-md text-sm leading-relaxed">
            This sheet has no recognizable Roll number / Name header — it is
            probably a summary or instructions tab. Pick the sheet with the
            student list.
          </p>
          {sheetPicker && <div className="mt-5">{sheetPicker}</div>}
        </div>
      </div>
    )
  }

  // ── Preview + edit state ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <FileSpreadsheetIcon className="text-muted-foreground size-4" />
            {fileName}
          </span>
          {sheetPicker}
          <span className="text-muted-foreground">
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </span>
          {flaggedCount > 0 ? (
            <span className="text-destructive">· {flaggedCount} to fix</span>
          ) : (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2Icon className="size-3.5" /> all clear
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={committing || flaggedCount > 0}
            onClick={commit}
          >
            {committing ? "Importing…" : `Import ${rows.length} students`}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Red cells disagree with the roll number (which encodes branch and
        division) or are missing. Edit any cell to fix it — the flag clears when
        it is resolved. Remove any row that is not a student (a section label
        left in the sheet) with the ✕ on its right.
      </p>

      <div className="border-border max-h-[65vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/60 sticky top-0">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-xs">#</TableHead>
              {COLUMNS.map((c) => (
                <TableHead key={c.key} className="text-xs">
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const flagFor = (key: string) =>
                row.flags.find((f) => f.field === key)
              return (
                <TableRow key={i} className="hover:bg-muted/30">
                  <TableCell className="text-muted-foreground text-xs">
                    {i + 1}
                  </TableCell>
                  {COLUMNS.map((c) => {
                    const flag = flagFor(c.key)
                    return (
                      <TableCell key={c.key} className="p-1">
                        <Input
                          value={String(row[c.key] ?? "")}
                          onChange={(e) => editCell(i, c.key, e.target.value)}
                          title={flag?.message}
                          className={cn(
                            "focus-visible:border-input h-8 border-transparent bg-transparent px-2 text-xs shadow-none",
                            flag &&
                              "border-destructive/40 bg-destructive/5 text-destructive"
                          )}
                        />
                        {flag && (
                          <p className="text-destructive px-2 pt-0.5 text-[10px] leading-tight">
                            {flag.message}
                          </p>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7"
                      title="Remove this row"
                      onClick={() => removeRow(i)}
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
