"use client"

import Link from "next/link"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { applyMapping, type MarkTarget } from "@/lib/marks-import"
import { saveMarksAction } from "../../../actions"

type Offering = { id: string; code: string; name: string }
type PreviewRow = {
  rollNumber: string
  name: string
  marks: (number | null)[]
  studentId: string | null
  matched: boolean
}
type Preview = {
  columnCount: number
  headers: string[]
  guess: MarkTarget[]
  rows: PreviewRow[]
  totalRows: number
  matchedRows: number
  truncated: boolean
}

const TARGETS: { value: MarkTarget; label: string }[] = [
  { value: "skip", label: "Skip" },
  { value: "isa", label: "ISA" },
  { value: "mse_avg", label: "MSE (avg)" },
  { value: "mse1", label: "MSE 1" },
  { value: "mse2", label: "MSE 2" },
  { value: "ese", label: "ESE" },
]

const fmt = (v: number | null) => (v === null ? "AB" : String(v))

export function ImportClient({
  classId,
  offerings,
  canAllocate,
}: {
  classId: string
  offerings: Offering[]
  canAllocate: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mapping, setMapping] = useState<MarkTarget[]>([])
  const [offeringId, setOfferingId] = useState("")
  const [committing, start] = useTransition()

  async function runPreview() {
    if (!file) return
    setUploading(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("classId", classId)
      const res = await fetch("/api/marks/import/preview", {
        method: "POST",
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not read that file")
        return
      }
      const data = json.data as Preview
      setPreview(data)
      setMapping(data.guess)
    } catch {
      toast.error("Could not read that file")
    } finally {
      setUploading(false)
    }
  }

  function setCol(i: number, target: MarkTarget) {
    setMapping((m) => m.map((t, idx) => (idx === i ? target : t)))
  }

  function commit() {
    if (!preview) return
    if (!offeringId) {
      toast.error("Pick the subject these marks belong to.")
      return
    }
    if (mapping.every((t) => t === "skip")) {
      toast.error("Map at least one column to a mark field.")
      return
    }
    const rows = preview.rows
      .filter((r) => r.matched && r.studentId)
      .map((r) => ({
        studentId: r.studentId!,
        ...applyMapping(r.marks, mapping),
      }))
    if (rows.length === 0) {
      toast.error("No parsed students match this class roster.")
      return
    }
    start(async () => {
      const res = await saveMarksAction({
        offeringId,
        rows,
        importFile: file
          ? { name: file.name, size: file.size, totalRows: preview.totalRows }
          : null,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Saved marks for ${rows.length} students`)
      router.push(`/dashboard/class/${classId}/marks?offering=${offeringId}`)
    })
  }

  const unmatched = preview ? preview.totalRows - preview.matchedRows : 0

  return (
    <div className="flex flex-col gap-5">
      {/* Step 1 — upload */}
      <div className="border-border flex flex-wrap items-end gap-3 rounded border p-4">
        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">
            Marksheet file (PDF or Excel)
          </span>
          <input
            ref={fileRef}
            type="file"
            aria-label="Marksheet file (PDF or Excel)"
            accept=".pdf,.xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPreview(null)
            }}
            className="file:border-border file:bg-muted text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5 file:text-sm"
          />
        </label>
        <Button size="sm" disabled={!file || uploading} onClick={runPreview}>
          {uploading ? "Reading…" : "Preview"}
        </Button>
        <p className="text-muted-foreground w-full text-xs leading-relaxed">
          Roll numbers are matched to this class. Rows from other divisions or
          students not yet enrolled are ignored.
        </p>
      </div>

      {preview && (
        <>
          {/* Step 2 — map columns + pick subject */}
          <div className="border-border flex flex-col gap-4 rounded border p-4">
            <div className="grid gap-1.5 sm:max-w-sm">
              {/* The label wraps only the select. Wrapping the hint too would
                  put its link inside a label, so clicking it would also drive
                  the select. */}
              {offerings.length > 0 && (
                <label className="grid gap-1.5">
                  <span className="text-muted-foreground text-xs">Subject</span>
                  <select
                    value={offeringId}
                    onChange={(e) => setOfferingId(e.target.value)}
                    className="border-border h-9 rounded border bg-transparent px-2 text-sm"
                  >
                    <option value="">Select a subject…</option>
                    {offerings.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.code} — {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Offered whether or not the list is empty: a marksheet for a
                  subject nobody has added yet looks identical to one for a
                  subject allocated to a colleague, and both dead-end here
                  unless the page says where to go. */}
              <p className="text-muted-foreground text-xs">
                {offerings.length === 0
                  ? "No subjects on this class are allocated to you. "
                  : "Subject not listed? "}
                {canAllocate ? (
                  <Link
                    href={`/dashboard/class/${classId}/subjects`}
                    className="underline"
                  >
                    Add one from the catalogue
                  </Link>
                ) : (
                  "Ask the class coordinator to add it and allocate it to you."
                )}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                Map columns ({preview.columnCount} detected)
              </p>
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: preview.columnCount }).map((_, i) => {
                  const samples = preview.rows
                    .slice(0, 3)
                    .map((r) => fmt(r.marks[i]))
                    .join(", ")
                  return (
                    <div
                      key={i}
                      className="border-border grid min-w-40 gap-1.5 rounded border p-2.5"
                    >
                      <span className="text-xs font-medium">
                        {preview.headers[i]?.trim() || `Column ${i + 1}`}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        e.g. {samples}
                      </span>
                      <select
                        value={mapping[i] ?? "skip"}
                        onChange={(e) =>
                          setCol(i, e.target.value as MarkTarget)
                        }
                        className="border-border h-8 rounded border bg-transparent px-2 text-sm"
                      >
                        {TARGETS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={committing} onClick={commit}>
                {committing ? "Saving…" : `Save ${preview.matchedRows} matched`}
              </Button>
              <span className="text-muted-foreground text-xs">
                {preview.matchedRows} matched · {unmatched} ignored
                {preview.truncated ? " · file truncated" : ""}
              </span>
            </div>
          </div>

          {/* Step 3 — preview */}
          <div className="border-border overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th>Roll</th>
                  <th>Name</th>
                  {Array.from({ length: preview.columnCount }).map((_, i) => (
                    <th key={i} className="w-16">
                      {preview.headers[i]?.trim() || `Col ${i + 1}`}
                    </th>
                  ))}
                  <th className="w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {preview.rows.map((r, idx) => (
                  <tr
                    key={`${r.rollNumber}-${idx}`}
                    className={
                      r.matched
                        ? "[&>td]:px-3 [&>td]:py-1.5"
                        : "text-muted-foreground [&>td]:px-3 [&>td]:py-1.5"
                    }
                  >
                    <td className="font-mono text-xs">{r.rollNumber}</td>
                    <td className="whitespace-nowrap">{r.name}</td>
                    {r.marks.map((m, i) => (
                      <td key={i} className="tabular-nums">
                        {fmt(m)}
                      </td>
                    ))}
                    <td>
                      {r.matched ? (
                        <Badge variant="outline">In class</Badge>
                      ) : (
                        <Badge variant="secondary">Not in class</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
