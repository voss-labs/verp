"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { updateCourseAction, setCourseActiveAction } from "../actions"

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
}

export function CoursesClient({
  courses,
  canEdit,
}: {
  courses: Course[]
  canEdit: boolean
}) {
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<Course | null>(null)

  const q = query.trim().toLowerCase()
  const view = q
    ? courses.filter(
        (c) =>
          c.courseCode.toLowerCase().includes(q) ||
          c.courseName.toLowerCase().includes(q)
      )
    : courses

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code or name…"
          className="h-9 max-w-xs"
        />
        <span className="text-muted-foreground text-xs">
          {view.length} of {courses.length}
        </span>
      </div>

      {courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No courses yet. They are created the first time a subject is added to
          a class.
        </p>
      ) : (
        <div className="border-border overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>Code</th>
                <th>Name</th>
                <th className="w-24">Type</th>
                <th className="w-16">Credits</th>
                <th className="w-32">Marks split</th>
                <th className="w-20">In use</th>
                <th className="w-20">Status</th>
                {canEdit && <th className="w-28"></th>}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {view.map((c) => (
                <tr key={c.id} className="[&>td]:px-3 [&>td]:py-1.5">
                  <td className="font-mono text-xs">{c.courseCode}</td>
                  <td>{c.courseName}</td>
                  <td className="capitalize">{c.courseType}</td>
                  <td className="tabular-nums">{c.credits}</td>
                  <td className="text-muted-foreground text-xs tabular-nums">
                    {c.maxIsa}/{c.maxMse}/{c.maxEse} · {c.maxTotal}
                  </td>
                  <td className="tabular-nums">
                    {c.offerings > 0 ? (
                      <Badge variant="secondary">{c.offerings}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditing(c)}
                      >
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EditDialog course={editing} onClose={() => setEditing(null)} />
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
            {form.courseCode}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              {form.departmentCode ?? "college-wide"}
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
