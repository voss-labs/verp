"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { computeMarks, type CourseInfo } from "@/lib/sgpi"
import { createSubjectAction, saveMarksAction } from "../../actions"

type Offering = { id: string; code: string; name: string; semester: number }
type Row = {
  studentId: string
  name: string
  rollNumber: string
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
}
type Grid = { offeringId: string; course: CourseInfo; rows: Row[] }

// VIT defaults per assessment type: theory carries the MSE component, practical
// and project are ISA + ESE only.
type CourseType = "theory" | "practical" | "project"
const CAP_PRESETS: Record<
  CourseType,
  { maxIsa: number; maxMse: number; maxEse: number; maxTotal: number }
> = {
  theory: { maxIsa: 20, maxMse: 20, maxEse: 60, maxTotal: 100 },
  practical: { maxIsa: 40, maxMse: 0, maxEse: 60, maxTotal: 100 },
  project: { maxIsa: 40, maxMse: 0, maxEse: 60, maxTotal: 100 },
}

export function MarksClient({
  classId,
  offerings,
  selectedId,
  grid,
}: {
  classId: string
  offerings: Offering[]
  selectedId: string | null
  grid: Grid | null
}) {
  if (grid && selectedId) {
    const offering = offerings.find((o) => o.id === selectedId)!
    return <MarksGrid classId={classId} offering={offering} grid={grid} />
  }
  return <SubjectSetup classId={classId} offerings={offerings} />
}

function SubjectSetup({
  classId,
  offerings,
}: {
  classId: string
  offerings: Offering[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [courseCode, setCourseCode] = useState("")
  const [courseName, setCourseName] = useState("")
  const [courseType, setCourseType] = useState<CourseType>("theory")
  const [credits, setCredits] = useState(3)
  const [semester, setSemester] = useState(1)
  const [caps, setCaps] = useState(CAP_PRESETS.theory)

  function pickType(t: CourseType) {
    setCourseType(t)
    setCaps(CAP_PRESETS[t])
  }

  function add() {
    start(async () => {
      const res = await createSubjectAction({
        classId,
        courseCode,
        courseName,
        courseType,
        credits,
        semester,
        ...caps,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Subject added")
      setCourseCode("")
      setCourseName("")
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Subjects</h2>
          <button
            type="button"
            onClick={() =>
              router.push(`/dashboard/class/${classId}/marks/import`)
            }
            className="text-muted-foreground hover:text-foreground text-xs underline"
          >
            Import from file
          </button>
        </div>
        {offerings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No subjects yet. Add one to start entering marks.
          </p>
        ) : (
          <div className="border-border overflow-hidden rounded border">
            <ul className="divide-border divide-y">
              {offerings.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/dashboard/class/${classId}/marks?offering=${o.id}`
                      )
                    }
                    className="hover:bg-muted flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        {o.code}
                      </Badge>
                      <span className="text-sm">{o.name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Sem {o.semester} · Enter marks →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-border flex flex-col gap-3 rounded border p-4">
        <h2 className="text-sm font-semibold">Add subject</h2>
        <Field label="Course code">
          <Input
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
            placeholder="ITC501"
            className="h-9 font-mono"
          />
        </Field>
        <Field label="Course name">
          <Input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Analog & Digital Communication"
            className="h-9"
          />
        </Field>
        <Field label="Type">
          <div className="flex overflow-hidden rounded border">
            {(["theory", "practical", "project"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => pickType(t)}
                className={cn(
                  "flex-1 px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                  courseType === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credits">
            <Input
              type="number"
              min={0}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              className="h-9"
            />
          </Field>
          <Field label="Semester">
            <Input
              type="number"
              min={1}
              max={8}
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
              className="h-9"
            />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(["maxIsa", "maxMse", "maxEse", "maxTotal"] as const).map((k) => (
            <Field
              key={k}
              label={
                { maxIsa: "ISA", maxMse: "MSE", maxEse: "ESE", maxTotal: "Total" }[
                  k
                ]
              }
            >
              <Input
                type="number"
                min={0}
                value={caps[k]}
                onChange={(e) =>
                  setCaps((c) => ({ ...c, [k]: Number(e.target.value) }))
                }
                className="h-9"
              />
            </Field>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-1"
          disabled={pending || !courseCode.trim() || !courseName.trim()}
          onClick={add}
        >
          {pending ? "Adding…" : "Add subject"}
        </Button>
      </div>
    </div>
  )
}

function MarksGrid({
  classId,
  offering,
  grid,
}: {
  classId: string
  offering: Offering
  grid: Grid
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rows, setRows] = useState<Row[]>(grid.rows)
  const { course } = grid
  const hasMse = course.maxMse > 0

  function edit(
    studentId: string,
    field: "isa" | "mse1" | "mse2" | "ese",
    value: string
  ) {
    const n = value === "" ? null : Number(value)
    setRows((rs) =>
      rs.map((r) => (r.studentId === studentId ? { ...r, [field]: n } : r))
    )
  }

  function save() {
    start(async () => {
      const res = await saveMarksAction({
        offeringId: offering.id,
        rows: rows.map((r) => ({
          studentId: r.studentId,
          isa: r.isa,
          mse1: r.mse1,
          mse2: r.mse2,
          ese: r.ese,
        })),
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Marks saved")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/class/${classId}/marks`)}
          >
            ← Subjects
          </Button>
          <Badge variant="outline" className="font-mono">
            {offering.code}
          </Badge>
          <span className="text-sm font-medium">{offering.name}</span>
          <span className="text-muted-foreground text-xs">
            ISA/{course.maxIsa}
            {hasMse ? ` · MSE/${course.maxMse}` : ""} · ESE/{course.maxEse} ·
            Total/{course.maxTotal}
          </span>
        </div>
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save marks"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No students in this class yet.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>Roll</th>
                <th>Name</th>
                <th className="w-20">ISA</th>
                {hasMse && <th className="w-20">MSE 1</th>}
                {hasMse && <th className="w-20">MSE 2</th>}
                <th className="w-20">ESE</th>
                <th className="w-16">Total</th>
                <th className="w-16">%</th>
                <th className="w-16">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => {
                const c = computeMarks(r, course)
                return (
                  <tr key={r.studentId} className="[&>td]:px-3 [&>td]:py-1.5">
                    <td className="font-mono text-xs">{r.rollNumber}</td>
                    <td className="whitespace-nowrap">{r.name}</td>
                    <td>
                      <MarkInput
                        value={r.isa}
                        max={course.maxIsa}
                        onChange={(v) => edit(r.studentId, "isa", v)}
                      />
                    </td>
                    {hasMse && (
                      <td>
                        <MarkInput
                          value={r.mse1}
                          max={course.maxMse}
                          onChange={(v) => edit(r.studentId, "mse1", v)}
                        />
                      </td>
                    )}
                    {hasMse && (
                      <td>
                        <MarkInput
                          value={r.mse2}
                          max={course.maxMse}
                          onChange={(v) => edit(r.studentId, "mse2", v)}
                        />
                      </td>
                    )}
                    <td>
                      <MarkInput
                        value={r.ese}
                        max={course.maxEse}
                        onChange={(v) => edit(r.studentId, "ese", v)}
                      />
                    </td>
                    <td className="tabular-nums">{c.total}</td>
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
      )}
    </div>
  )
}

function MarkInput({
  value,
  max,
  onChange,
}: {
  value: number | null
  max: number
  onChange: (v: string) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      max={max}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-16 tabular-nums"
    />
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-muted-foreground text-xs">{label}</label>
      {children}
    </div>
  )
}
