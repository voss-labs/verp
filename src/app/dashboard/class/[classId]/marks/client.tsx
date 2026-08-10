"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { computeMarks, type CourseInfo } from "@/lib/sgpi"
import { downloadBase64File } from "@/lib/utils"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import {
  createSubjectAction,
  saveMarksAction,
  setMarksLockAction,
} from "../../actions"

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
type LockComponent = "isa" | "mse" | "ese"
type Grid = {
  offeringId: string
  course: CourseInfo
  rows: Row[]
  locked: LockComponent[]
}

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

const LOCK_LABEL: Record<LockComponent, string> = {
  isa: "ISA",
  mse: "MSE",
  ese: "ESE",
}

export function MarksClient({
  classId,
  offerings,
  selectedId,
  grid,
  canUnlock,
}: {
  classId: string
  offerings: Offering[]
  selectedId: string | null
  grid: Grid | null
  canUnlock: boolean
}) {
  if (grid && selectedId) {
    const offering = offerings.find((o) => o.id === selectedId)!
    return (
      <MarksGrid
        classId={classId}
        offering={offering}
        grid={grid}
        canUnlock={canUnlock}
      />
    )
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
                {
                  maxIsa: "ISA",
                  maxMse: "MSE",
                  maxEse: "ESE",
                  maxTotal: "Total",
                }[k]
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
  canUnlock,
}: {
  classId: string
  offering: Offering
  grid: Grid
  canUnlock: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rows, setRows] = useState<Row[]>(grid.rows)
  const { course } = grid
  const hasMse = course.maxMse > 0
  const locked = grid.locked
  const isLocked = (c: LockComponent) => locked.includes(c)
  // Nothing left to enter: every component this course has is frozen.
  const allLocked =
    isLocked("isa") && isLocked("ese") && (!hasMse || isLocked("mse"))

  function toggleLock(component: LockComponent, next: boolean) {
    start(async () => {
      const res = await setMarksLockAction({
        offeringId: offering.id,
        component,
        locked: next,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(
        next
          ? `${LOCK_LABEL[component]} locked`
          : `${LOCK_LABEL[component]} reopened`
      )
      router.refresh()
    })
  }

  async function handleExport(format: "csv" | "xlsx") {
    const headers = [
      "Roll",
      "Name",
      "ISA",
      ...(hasMse ? ["MSE 1", "MSE 2"] : []),
      "ESE",
      "Total",
      "%",
      "Grade",
    ]
    const body = rows.map((r) => {
      const c = computeMarks(r, course)
      return [
        r.rollNumber,
        r.name,
        r.isa,
        ...(hasMse ? [r.mse1, r.mse2] : []),
        r.ese,
        c.total,
        c.percentage,
        c.gradePoint == null ? "" : String(c.gradePoint),
      ]
    })
    const date = new Date().toISOString().split("T")[0]
    const filename = `Marks_${offering.code}_${date}.${format}`
    if (format === "xlsx") {
      const b64 = await exportTableXlsx({
        title: `Marks — ${offering.code}`,
        subtitle: offering.name,
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={rows.length === 0}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={rows.length === 0}
          >
            Excel
          </Button>
          <Button size="sm" disabled={pending || allLocked} onClick={save}>
            {pending ? "Saving…" : "Save marks"}
          </Button>
        </div>
      </div>

      <LockPanel
        hasMse={hasMse}
        isLocked={isLocked}
        canUnlock={canUnlock}
        pending={pending}
        onToggle={toggleLock}
      />

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
                        locked={isLocked("isa")}
                        onChange={(v) => edit(r.studentId, "isa", v)}
                      />
                    </td>
                    {hasMse && (
                      <td>
                        <MarkInput
                          value={r.mse1}
                          max={course.maxMse}
                          locked={isLocked("mse")}
                          onChange={(v) => edit(r.studentId, "mse1", v)}
                        />
                      </td>
                    )}
                    {hasMse && (
                      <td>
                        <MarkInput
                          value={r.mse2}
                          max={course.maxMse}
                          locked={isLocked("mse")}
                          onChange={(v) => edit(r.studentId, "mse2", v)}
                        />
                      </td>
                    )}
                    <td>
                      <MarkInput
                        value={r.ese}
                        max={course.maxEse}
                        locked={isLocked("ese")}
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
  locked,
  onChange,
}: {
  value: number | null
  max: number
  locked?: boolean
  onChange: (v: string) => void
}) {
  return (
    <Input
      type="number"
      min={0}
      max={max}
      value={value ?? ""}
      readOnly={locked}
      disabled={locked}
      aria-label={locked ? "Locked — submitted" : undefined}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-16 tabular-nums",
        locked && "bg-muted text-muted-foreground cursor-not-allowed"
      )}
    />
  )
}

/**
 * The components are frozen separately because they finish at different points
 * in the term. Locking is offered to anyone who can enter marks; reopening is
 * hidden unless the viewer is the coordinator or above, and the server enforces
 * that regardless of what this renders.
 */
function LockPanel({
  hasMse,
  isLocked,
  canUnlock,
  pending,
  onToggle,
}: {
  hasMse: boolean
  isLocked: (c: LockComponent) => boolean
  canUnlock: boolean
  pending: boolean
  onToggle: (c: LockComponent, next: boolean) => void
}) {
  const components: LockComponent[] = hasMse
    ? ["isa", "mse", "ese"]
    : ["isa", "ese"]
  return (
    <div className="border-border flex flex-wrap items-center gap-2 rounded border px-3 py-2">
      <span className="text-muted-foreground mr-1 text-xs font-medium">
        Components
      </span>
      {components.map((c) => {
        const locked = isLocked(c)
        return (
          <div key={c} className="flex items-center gap-1.5">
            <Badge variant={locked ? "secondary" : "outline"}>
              {LOCK_LABEL[c]}
              {locked ? " · locked" : ""}
            </Badge>
            {locked ? (
              canUnlock ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={pending}
                  onClick={() => onToggle(c, false)}
                >
                  Unlock
                </Button>
              ) : null
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={pending}
                onClick={() => onToggle(c, true)}
              >
                Lock
              </Button>
            )}
          </div>
        )
      })}
      {!canUnlock && (
        <span className="text-muted-foreground ml-auto text-xs">
          Ask the class coordinator to reopen a locked component.
        </span>
      )}
    </div>
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
