"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadBase64File } from "@/lib/utils"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { computeMarks, type CourseInfo } from "@/lib/sgpi"

type Subject = {
  semester: number
  code: string
  name: string
  marks: {
    isa: number | null
    mse1: number | null
    mse2: number | null
    ese: number | null
  }
  course: CourseInfo
}
type Row = {
  studentId: string
  rollNumber: string
  name: string
  cgpa: number | null
  hasFail: boolean
  totalCredits: number
  semesters: number
  subjects: Subject[]
}

type SortField = "rollNumber" | "name" | "cgpa" | "credits"
type SortDir = "asc" | "desc"

export function ResultsClient({
  rows,
  classLabel,
}: {
  rows: Row[]
  classLabel: string
}) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortField>("rollNumber")
  const [dir, setDir] = useState<SortDir>("asc")
  const [open, setOpen] = useState<Row | null>(null)

  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? rows.filter(
          (r) =>
            r.rollNumber.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q)
        )
      : rows
    const sign = dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "name":
          return sign * a.name.localeCompare(b.name)
        case "credits":
          return sign * (a.totalCredits - b.totalCredits)
        case "cgpa":
          // Ungraded students sort last either way — a null CGPA is "not yet",
          // not "zero", and floating them to the top of an ascending sort would
          // bury the students who actually have low marks.
          if (a.cgpa == null && b.cgpa == null) return 0
          if (a.cgpa == null) return 1
          if (b.cgpa == null) return -1
          return sign * (a.cgpa - b.cgpa)
        default:
          return sign * a.rollNumber.localeCompare(b.rollNumber)
      }
    })
  }, [rows, query, sort, dir])

  function toggleSort(field: SortField) {
    if (sort === field) setDir(dir === "asc" ? "desc" : "asc")
    else {
      setSort(field)
      setDir("asc")
    }
  }

  async function handleExport(format: "csv" | "xlsx") {
    const headers = ["Roll", "Name", "CGPA", "Credits", "Semesters", "Status"]
    const body = view.map((r) => [
      r.rollNumber,
      r.name,
      r.hasFail ? "" : (r.cgpa ?? ""),
      r.totalCredits,
      r.semesters,
      r.hasFail ? "Has fail" : r.cgpa == null ? "No marks" : "OK",
    ])
    const date = new Date().toISOString().split("T")[0]
    const filename = `Results_${classLabel}_${date}.${format}`
    if (format === "xlsx") {
      const b64 = await exportTableXlsx({
        title: `Results — ${classLabel}`,
        headers,
        rows: body,
      })
      downloadBase64File(
        b64,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    } else {
      downloadBase64File(
        await exportTableCsv({ headers, rows: body }),
        filename,
        "text/csv"
      )
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by roll number or name…"
          className="h-9 max-w-xs"
        />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {view.length} of {rows.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
          >
            Excel
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No students in this class yet.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr>
                <Th
                  onClick={() => toggleSort("rollNumber")}
                  active={sort === "rollNumber"}
                  dir={dir}
                >
                  Roll
                </Th>
                <Th
                  onClick={() => toggleSort("name")}
                  active={sort === "name"}
                  dir={dir}
                >
                  Name
                </Th>
                <Th
                  onClick={() => toggleSort("cgpa")}
                  active={sort === "cgpa"}
                  dir={dir}
                >
                  CGPA
                </Th>
                <Th
                  onClick={() => toggleSort("credits")}
                  active={sort === "credits"}
                  dir={dir}
                >
                  Credits
                </Th>
                <th className="px-3 py-2 text-left font-medium">Semesters</th>
                <th className="px-3 py-2 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {view.map((r) => (
                <tr key={r.studentId} className="[&>td]:px-3 [&>td]:py-1.5">
                  <td className="font-mono text-xs">{r.rollNumber}</td>
                  <td className="whitespace-nowrap">{r.name}</td>
                  <td className="tabular-nums">
                    {r.hasFail ? (
                      <Badge variant="destructive">Fail</Badge>
                    ) : (
                      (r.cgpa?.toFixed(2) ?? (
                        <span className="text-muted-foreground">—</span>
                      ))
                    )}
                  </td>
                  <td className="tabular-nums">{r.totalCredits}</td>
                  <td className="tabular-nums">{r.semesters}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={r.subjects.length === 0}
                      onClick={() => setOpen(r)}
                    >
                      Breakdown
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {open?.name}{" "}
              <span className="text-muted-foreground font-mono text-xs">
                {open?.rollNumber}
              </span>
            </DialogTitle>
          </DialogHeader>
          {open && <Breakdown row={open} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Breakdown({ row }: { row: Row }) {
  const bySem = new Map<number, Subject[]>()
  for (const s of row.subjects) {
    const list = bySem.get(s.semester) ?? []
    list.push(s)
    bySem.set(s.semester, list)
  }
  const semesters = [...bySem.entries()].sort((a, b) => a[0] - b[0])
  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
      {semesters.map(([semester, subjects]) => (
        <div key={semester}>
          <h3 className="mb-2 text-sm font-semibold">Semester {semester}</h3>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="[&>th]:px-2 [&>th]:py-1 [&>th]:text-left [&>th]:font-medium">
                <th>Code</th>
                <th>Subject</th>
                <th className="w-16">Total</th>
                <th className="w-14">%</th>
                <th className="w-14">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {subjects.map((s) => {
                const c = computeMarks(s.marks, s.course)
                return (
                  <tr key={s.code} className="[&>td]:px-2 [&>td]:py-1">
                    <td className="font-mono text-xs">{s.code}</td>
                    <td>{s.name}</td>
                    <td className="tabular-nums">
                      {c.percentage == null
                        ? "—"
                        : `${c.total}/${s.course.maxTotal}`}
                    </td>
                    <td className="text-muted-foreground tabular-nums">
                      {c.percentage ?? "—"}
                    </td>
                    <td>
                      {c.gradePoint == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : c.gradePoint === "Fail" ? (
                        <Badge variant="destructive">Fail</Badge>
                      ) : (
                        <Badge variant="outline">{c.gradePoint}</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  dir: SortDir
}) {
  return (
    <th className="px-3 py-2 text-left font-medium">
      <button
        type="button"
        onClick={onClick}
        className="hover:text-foreground inline-flex items-center gap-1"
      >
        {children}
        {active && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  )
}
