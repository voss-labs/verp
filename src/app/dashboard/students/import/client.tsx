"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { UploadCloudIcon, FileSpreadsheetIcon, CheckCircle2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  { key: "semester", label: "Sem" },
]

type PreviewResponse = {
  rows: PreviewRow[]
  totalRows: number
  flaggedRows: number
  truncated: boolean
}

export function ImportClient() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<PreviewRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)

  const flaggedCount = useMemo(
    () => rows?.filter((r) => r.flags.length > 0).length ?? 0,
    [rows]
  )

  async function handleFile(file: File) {
    setLoading(true)
    setRows(null)
    setFileName(file.name)
    try {
      const form = new FormData()
      form.append("file", file)
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
      setRows(data.rows)
      if (data.truncated) {
        toast.warning(`Only the first ${data.rows.length} rows were read.`)
      }
    } catch {
      toast.error("Upload failed. Try again.")
    } finally {
      setLoading(false)
    }
  }

  // Live re-validation: as the TR fixes a cell, re-run the same flagRow the
  // server used, so red flags clear the instant they're resolved.
  function editCell(index: number, key: keyof PreviewRow, value: string) {
    setRows((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const { flags: _drop, ...fields } = next[index]
      next[index] = flagRow({ ...fields, [key]: value }, new Date())
      return next
    })
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
            lastName: r.lastName,
            email: r.email,
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
        // Surface the DB-level failures (e.g. an already-existing roll number)
        // back onto the rows so the TR can see which.
        setRows((prev) => {
          if (!prev) return prev
          const next = [...prev]
          for (const e of errors) {
            const i = e.row - 1
            if (next[i]) next[i] = { ...next[i], flags: [{ field: "rollNumber", message: e.message }] }
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
  if (!rows) {
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
          An Excel sheet of students — roll number, name, email, and whatever
          columns you have. We map the columns and check every roll number
          before anything is saved. Marks, SGPI and attendance are never
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

  // ── Preview + edit state ──────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheetIcon className="text-muted-foreground size-4" />
          <span className="font-medium">{fileName}</span>
          <span className="text-muted-foreground">
            · {rows.length} row{rows.length === 1 ? "" : "s"}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRows(null)
              setFileName(null)
            }}
          >
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
        it's resolved.
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
                            "h-8 border-transparent bg-transparent px-2 text-xs shadow-none focus-visible:border-input",
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
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
