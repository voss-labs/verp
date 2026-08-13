"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { bulkCreateCoursesAction } from "../../actions"

// The total is the sum of the three components by definition — the parser only
// accepts a row when they balance. Deriving it here rather than letting it be
// typed removes the one way a reviewer could produce a row the server would
// reject, and doubles as a check on their own edit: mistype ISA and the total
// stops matching the figure printed in the syllabus.
const parsedTotal = (r: Row) => r.maxIsa + r.maxMse + r.maxEse

type CourseType = "theory" | "practical" | "project"
type Row = {
  courseCode: string
  courseName: string
  courseType: CourseType
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  nameSource: "detail" | "table" | "none"
  warnings: string[]
}

export function ImportClient({
  departments,
}: {
  departments: { code: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [dept, setDept] = useState(departments[0].code)
  // Asked rather than parsed. Each syllabus PDF covers exactly one year, and the
  // person uploading it knows which — reading it out of the cover page would be
  // a guess where a two-click answer is certain.
  const [year, setYear] = useState("FE")
  const [rows, setRows] = useState<Row[] | null>(null)
  const [meta, setMeta] = useState<{ fileName: string; pages: number } | null>(
    null
  )
  const [picked, setPicked] = useState<Set<string>>(new Set())

  async function upload(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/courses/import/preview", {
        method: "POST",
        body,
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? "Could not read that PDF")
        return
      }
      const parsed = json.data.courses as Row[]
      setRows(parsed)
      setMeta({ fileName: json.data.fileName, pages: json.data.pages })
      // Pre-select only rows whose name came from a labelled "Course Name:"
      // field. Names recovered from the scheme table agree with those only
      // about half the time, and a wrong name that looks filled in never gets
      // proofread — so those are opted in by hand, after a look.
      setPicked(
        new Set(
          parsed
            .filter((r) => r.nameSource === "detail" && r.warnings.length === 0)
            .map((r) => r.courseCode)
        )
      )
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function edit(code: string, patch: Partial<Row>) {
    setRows((rs) =>
      rs ? rs.map((r) => (r.courseCode === code ? { ...r, ...patch } : r)) : rs
    )
  }

  function commit() {
    if (!rows) return
    const chosen = rows.filter((r) => picked.has(r.courseCode))
    start(async () => {
      const res = await bulkCreateCoursesAction({
        departmentCode: dept,
        year,
        courses: chosen.map((c) => ({
          courseCode: c.courseCode,
          courseName: c.courseName,
          courseType: c.courseType,
          credits: c.credits,
          maxIsa: c.maxIsa,
          maxMse: c.maxMse,
          maxEse: c.maxEse,
          maxTotal: parsedTotal(c),
        })),
      })
      if (res.created != null) {
        toast.success(
          `Imported ${res.created}${res.skipped ? `, skipped ${res.skipped} already present` : ""}`
        )
        if (res.error) toast.error(res.error)
        router.push("/dashboard/dept/courses")
        router.refresh()
        return
      }
      toast.error(res.error ?? "Import failed")
    })
  }

  if (!rows) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Upload a Scheme &amp; Syllabus PDF. The scheme table gives each
          course&apos;s code, credits and marks split; the per-course pages give
          the names. Everything is shown for review before anything is saved.
        </p>
        <Input
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
          }}
        />
        {uploading && (
          <p className="text-muted-foreground text-sm">
            Reading the PDF — a few hundred pages takes a moment…
          </p>
        )}
      </div>
    )
  }

  const trusted = rows.filter((r) => r.nameSource === "detail").length
  const suggested = rows.filter((r) => r.nameSource === "table").length

  // Catch here what the action would reject anyway, so an edit that breaks a
  // row says so next to the row rather than as a toast after a round trip.
  const chosen = rows.filter((r) => picked.has(r.courseCode))
  const broken = chosen.filter(
    (r) => !r.courseName.trim() || r.credits < 1 || parsedTotal(r) < 1
  )
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="font-medium">{meta?.fileName}</span>{" "}
          <span className="text-muted-foreground">
            · {meta?.pages} pages · {rows.length} courses · {trusted} names
            confirmed from the syllabus
            {suggested > 0 && `, ${suggested} read off the table — check these`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dept} onValueChange={(v) => v && setDept(v)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={(v) => v && setYear(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FE">First Year</SelectItem>
              <SelectItem value="SE">Second Year</SelectItem>
              <SelectItem value="TE">Third Year</SelectItem>
              <SelectItem value="BE">Final Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setRows(null)}>
            Start over
          </Button>
          <Button
            size="sm"
            disabled={pending || picked.size === 0}
            onClick={commit}
          >
            {pending ? "Importing…" : `Import ${picked.size}`}
          </Button>
        </div>
      </div>

      {broken.length > 0 && (
        <p className="text-destructive text-sm">
          {broken.length} selected{" "}
          {broken.length === 1 ? "row needs" : "rows need"} a name and at least
          one credit before importing:{" "}
          {broken
            .slice(0, 6)
            .map((r) => r.courseCode)
            .join(", ")}
          {broken.length > 6 && "…"}
        </p>
      )}

      <div className="border-border overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-8">
                <span className="sr-only">Include</span>
              </th>
              <th className="w-24">Code</th>
              <th>Name</th>
              <th className="w-28">Type</th>
              <th className="w-16">Cr</th>
              <th className="w-20">ISA</th>
              <th className="w-20">MSE</th>
              <th className="w-20">ESE</th>
              <th className="w-16">Total</th>
              <th>Needs attention</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((r) => {
              const flagged = r.warnings.length > 0
              return (
                <tr
                  key={r.courseCode}
                  className={cn(
                    flagged && "bg-destructive/5",
                    picked.has(r.courseCode) &&
                      (!r.courseName.trim() || r.credits < 1) &&
                      "outline-destructive outline outline-1 -outline-offset-1"
                  )}
                >
                  <td className="px-2">
                    <Checkbox
                      checked={picked.has(r.courseCode)}
                      onCheckedChange={(v) => {
                        const next = new Set(picked)
                        if (v) next.add(r.courseCode)
                        else next.delete(r.courseCode)
                        setPicked(next)
                      }}
                    />
                  </td>
                  <td className="px-2 font-mono text-xs">{r.courseCode}</td>
                  <td className="px-2">
                    <Input
                      value={r.courseName}
                      placeholder="Type the name"
                      onChange={(e) =>
                        edit(r.courseCode, { courseName: e.target.value })
                      }
                      className="h-8"
                    />
                  </td>
                  <td className="px-2">
                    <Select
                      value={r.courseType}
                      onValueChange={(v) =>
                        v && edit(r.courseCode, { courseType: v as CourseType })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="theory">Theory</SelectItem>
                        <SelectItem value="practical">Practical</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2">
                    <NumCell
                      value={r.credits}
                      onChange={(v) => edit(r.courseCode, { credits: v })}
                    />
                  </td>
                  <td className="px-2">
                    <NumCell
                      value={r.maxIsa}
                      onChange={(v) => edit(r.courseCode, { maxIsa: v })}
                    />
                  </td>
                  <td className="px-2">
                    <NumCell
                      value={r.maxMse}
                      onChange={(v) => edit(r.courseCode, { maxMse: v })}
                    />
                  </td>
                  <td className="px-2">
                    <NumCell
                      value={r.maxEse}
                      onChange={(v) => edit(r.courseCode, { maxEse: v })}
                    />
                  </td>
                  <td
                    className={cn(
                      "px-2 tabular-nums",
                      parsedTotal(r) !== r.maxTotal &&
                        "text-destructive font-medium"
                    )}
                    title={
                      parsedTotal(r) !== r.maxTotal
                        ? `The syllabus stated ${r.maxTotal}`
                        : undefined
                    }
                  >
                    {parsedTotal(r)}
                  </td>
                  <td className="px-2">
                    {r.warnings.map((w) => (
                      <Badge key={w} variant="outline" className="mr-1 text-xs">
                        {w}
                      </Badge>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NumCell({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="h-8 w-16 tabular-nums"
    />
  )
}
