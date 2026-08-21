"use client"

import Link from "next/link"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/empty-state"
import { MarksSplitBar } from "@/components/marks-split-bar"
import { BookOpenIcon } from "lucide-react"
import {
  createCourseAction,
  updateCourseAction,
  setCourseActiveAction,
} from "../actions"

// Same VIT defaults the class-level subject form uses: theory carries the MSE
// component, practical and project are ISA + ESE only. Kept in step so a course
// created here and one created from a class come out identical.
const CAP_PRESETS: Record<
  CourseType,
  { maxIsa: number; maxMse: number; maxEse: number; maxTotal: number }
> = {
  theory: { maxIsa: 20, maxMse: 20, maxEse: 60, maxTotal: 100 },
  practical: { maxIsa: 40, maxMse: 0, maxEse: 60, maxTotal: 100 },
  project: { maxIsa: 40, maxMse: 0, maxEse: 60, maxTotal: 100 },
}

type CourseType = "theory" | "practical" | "project"
type Course = {
  id: string
  courseCode: string
  courseName: string
  departmentCode: string | null
  courseType: string
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  isActive: boolean
  offerings: number
  year: string | null
}

const YEARS = ["FE", "SE", "TE", "BE"] as const
const YEAR_LABEL: Record<string, string> = {
  FE: "First year",
  SE: "Second year",
  TE: "Third year",
  BE: "Final year",
}
const TYPE_LABEL: Record<string, string> = {
  theory: "Theory",
  practical: "Practical",
  project: "Project",
}

function marksSegments(c: { maxIsa: number; maxMse: number; maxEse: number }) {
  return [
    { label: "ISA", value: c.maxIsa },
    { label: "MSE", value: c.maxMse },
    { label: "ESE", value: c.maxEse },
  ].filter((s) => s.value > 0)
}

export function CoursesClient({
  courses,
  canEdit,
  canCreate,
  departments,
}: {
  courses: Course[]
  canEdit: boolean
  canCreate: boolean
  departments: { code: string; name: string }[]
}) {
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Course | null>(null)
  const [creating, setCreating] = useState(false)
  const [yearFilter, setYearFilter] = useState<string>("all")
  const [deptFilter, setDeptFilter] = useState<string>("all")

  const q = query.trim().toLowerCase()
  const view = courses.filter((c) => {
    if (q && !`${c.courseCode} ${c.courseName}`.toLowerCase().includes(q))
      return false
    if (yearFilter !== "all" && (c.year ?? "") !== yearFilter) return false
    if (deptFilter !== "all" && (c.departmentCode ?? "") !== deptFilter)
      return false
    return true
  })

  // Counts come from the full list, not the filtered one: a year showing 0 is
  // information, and hiding the option would make it look like it never existed.
  const countFor = (y: string) =>
    courses.filter((c) => (c.year ?? "") === y).length
  const deptsPresent = [
    ...new Set(
      courses.map((c) => c.departmentCode).filter((d): d is string => !!d)
    ),
  ].sort()

  const yearItems = [
    { value: "all", label: "All years" },
    ...YEARS.map((y) => ({
      value: y as string,
      label: `${YEAR_LABEL[y]} (${countFor(y)})`,
    })),
  ]
  const deptItems = [
    { value: "all", label: "All departments" },
    ...deptsPresent.map((d) => ({ value: d, label: d })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by code or name…"
            className="h-9 w-56"
          />
          <Select
            value={yearFilter}
            items={yearItems}
            onValueChange={(v) => v && setYearFilter(v)}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Filter by year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {deptsPresent.length > 1 && (
            <Select
              value={deptFilter}
              items={deptItems}
              onValueChange={(v) => v && setDeptFilter(v)}
            >
              <SelectTrigger
                className="h-9 w-40"
                aria-label="Filter by department"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deptItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            {view.length} of {courses.length}
          </span>
          {canCreate && departments.length > 0 && (
            <>
              <Link
                href="/dashboard/dept/courses/import"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Import syllabus
              </Link>
              <Button size="sm" onClick={() => setCreating(true)}>
                Add course
              </Button>
            </>
          )}
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          variant="dashed"
          title="No courses yet"
          description="Import a syllabus, or add a course — one is also created the first time a subject is added to a class."
        />
      ) : (
        <div className="border-border overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>Code</th>
                <th>Name</th>
                <th className="w-20">Year</th>
                {deptsPresent.length > 1 && <th className="w-20">Dept</th>}
                <th className="w-24">Type</th>
                <th className="w-16">Credits</th>
                <th className="w-36">Marks split</th>
                <th className="w-20">In use</th>
                <th className="w-20">Status</th>
                {canEdit && (
                  <th className="w-28">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {view.map((c) => {
                const usage = `In use on ${c.offerings} class${c.offerings === 1 ? "" : "es"}`
                return (
                  <tr key={c.id} className="[&>td]:px-3 [&>td]:py-1.5">
                    <td className="identifier">{c.courseCode}</td>
                    <td>{c.courseName}</td>
                    <td>
                      {c.year ? (
                        <Badge variant="outline">{c.year}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    {deptsPresent.length > 1 && (
                      <td className="text-muted-foreground text-xs">
                        {c.departmentCode ?? "—"}
                      </td>
                    )}
                    <td>{TYPE_LABEL[c.courseType] ?? c.courseType}</td>
                    <td className="tabular-nums">{c.credits}</td>
                    <td>
                      <MarksSplitBar
                        compact
                        segments={marksSegments(c)}
                        total={c.maxTotal}
                      />
                      <span className="identifier text-muted-foreground">
                        {c.maxIsa}/{c.maxMse}/{c.maxEse} · {c.maxTotal}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {c.offerings > 0 ? (
                        <Badge
                          variant="secondary"
                          title={usage}
                          aria-label={usage}
                        >
                          {c.offerings}
                        </Badge>
                      ) : (
                        <span
                          className="text-muted-foreground"
                          title="Not on any class yet"
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      {c.isActive ? (
                        <Badge variant="outline">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Retired</Badge>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          className="text-blue text-xs underline-offset-2 hover:underline"
                          onClick={() => setEditing(c)}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <EditDialog course={editing} onClose={() => setEditing(null)} />
      {creating && (
        <CreateDialog
          departments={departments}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

function EditDialog({
  course,
  onClose,
}: {
  course: Course | null
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [form, setForm] = useState<Course | null>(course)

  // Re-seed when a different row is opened.
  if (course && form?.id !== course.id) setForm(course)
  if (!course || !form) return null

  const split = form.maxIsa + form.maxMse + form.maxEse
  const mismatch = split !== form.maxTotal

  function save() {
    if (!form) return
    start(async () => {
      const res = await updateCourseAction({
        courseId: form.id,
        courseName: form.courseName,
        courseType: form.courseType as CourseType,
        year: form.year,
        credits: form.credits,
        maxIsa: form.maxIsa,
        maxMse: form.maxMse,
        maxEse: form.maxEse,
        maxTotal: form.maxTotal,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Course updated")
      onClose()
      router.refresh()
    })
  }

  function toggleActive() {
    if (!form) return
    start(async () => {
      const res = await setCourseActiveAction({
        courseId: form.id,
        isActive: !form.isActive,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(form.isActive ? "Course retired" : "Course reactivated")
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <span className="identifier">{form.courseCode}</span>{" "}
            <span className="text-muted-foreground text-sm font-normal">
              {form.departmentCode ?? "College-wide"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Name">
            <Input
              value={form.courseName}
              onChange={(e) => setForm({ ...form, courseName: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select
                value={form.courseType}
                items={TYPE_LABEL}
                // Base UI hands back null when a select is cleared; the course
                // must always have a type, so a clear is simply ignored.
                onValueChange={(v) => v && setForm({ ...form, courseType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="theory">Theory</SelectItem>
                  <SelectItem value="practical">Practical</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Credits">
              <Input
                type="number"
                min={1}
                value={form.credits}
                onChange={(e) =>
                  setForm({ ...form, credits: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Year">
              <Select
                value={form.year ?? "none"}
                items={{ none: "Not set", ...YEAR_LABEL }}
                onValueChange={(v) =>
                  v && setForm({ ...form, year: v === "none" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {YEAR_LABEL[y]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Max ISA">
              <Input
                type="number"
                min={0}
                value={form.maxIsa}
                onChange={(e) =>
                  setForm({ ...form, maxIsa: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Max MSE">
              <Input
                type="number"
                min={0}
                value={form.maxMse}
                onChange={(e) =>
                  setForm({ ...form, maxMse: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Max ESE">
              <Input
                type="number"
                min={0}
                value={form.maxEse}
                onChange={(e) =>
                  setForm({ ...form, maxEse: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Total">
              <Input
                type="number"
                min={1}
                value={form.maxTotal}
                onChange={(e) =>
                  setForm({ ...form, maxTotal: Number(e.target.value) })
                }
              />
            </Field>
          </div>

          {mismatch && (
            <p className="text-destructive text-xs">
              ISA + MSE + ESE is {split}, which does not equal the total (
              {form.maxTotal}).
            </p>
          )}
          {form.offerings > 0 && (
            <p className="text-muted-foreground text-xs">
              Taught in {form.offerings} class
              {form.offerings === 1 ? "" : "es"}. Changing the maxima re-scales
              percentages for marks already recorded against it.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={toggleActive}
          >
            {form.isActive ? "Retire" : "Reactivate"}
          </Button>
          <Button size="sm" disabled={pending || mismatch} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function CreateDialog({
  departments,
  onClose,
}: {
  departments: { code: string; name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [dept, setDept] = useState(departments[0]?.code ?? "")
  const [type, setType] = useState<CourseType>("theory")
  const [credits, setCredits] = useState(3)
  const [year, setYear] = useState("FE")
  const [caps, setCaps] = useState(CAP_PRESETS.theory)

  // Changing the type re-seeds the maxima rather than leaving a theory split on
  // a practical, which is the mistake this form exists to prevent.
  function pickType(next: CourseType) {
    setType(next)
    setCaps(CAP_PRESETS[next])
  }

  const split = caps.maxIsa + caps.maxMse + caps.maxEse
  const mismatch = split !== caps.maxTotal
  const ready = code.trim() && name.trim() && dept && !mismatch && credits >= 1

  function save() {
    start(async () => {
      const res = await createCourseAction({
        courseCode: code,
        courseName: name,
        departmentCode: dept,
        courseType: type,
        year,
        credits,
        ...caps,
      })
      if (res.error) return void toast.error(res.error)
      toast.success(`${code.trim().toUpperCase()} added`)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add course</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ITC501"
                className="identifier"
              />
            </Field>
            <div className="col-span-2">
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Analog & Digital Communication"
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Department">
              <Select
                value={dept}
                onValueChange={(v) => v && setDept(v)}
                disabled={departments.length === 1}
              >
                <SelectTrigger>
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
            </Field>
            <Field label="Type">
              <Select
                value={type}
                items={TYPE_LABEL}
                onValueChange={(v) => v && pickType(v as CourseType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="theory">Theory</SelectItem>
                  <SelectItem value="practical">Practical</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Credits">
              <Input
                type="number"
                min={1}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
              />
            </Field>
            <Field label="Year">
              <Select
                value={year}
                items={YEAR_LABEL}
                onValueChange={(v) => v && setYear(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {YEAR_LABEL[y]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Field label="Max ISA">
              <Input
                type="number"
                min={0}
                value={caps.maxIsa}
                onChange={(e) =>
                  setCaps({ ...caps, maxIsa: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Max MSE">
              <Input
                type="number"
                min={0}
                value={caps.maxMse}
                onChange={(e) =>
                  setCaps({ ...caps, maxMse: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Max ESE">
              <Input
                type="number"
                min={0}
                value={caps.maxEse}
                onChange={(e) =>
                  setCaps({ ...caps, maxEse: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Total">
              <Input
                type="number"
                min={1}
                value={caps.maxTotal}
                onChange={(e) =>
                  setCaps({ ...caps, maxTotal: Number(e.target.value) })
                }
              />
            </Field>
          </div>

          {mismatch && (
            <p className="text-destructive text-xs">
              ISA + MSE + ESE is {split}, which does not equal the total (
              {caps.maxTotal}).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button size="sm" disabled={pending || !ready} onClick={save}>
            {pending ? "Adding…" : "Add course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
