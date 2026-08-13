"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  assignClassRoleAction,
  removeClassRoleAction,
  assignSubjectToTeacherAction,
} from "../actions"
import { assignOfferingFacultyAction } from "../../class/actions"

type Faculty = {
  id: string
  name: string
  email: string
  department: string
  tier: string
  claimed: boolean
}
type Klass = {
  id: string
  departmentCode: string
  label: string
  classKey: string
}
type Staff = { classId: string; facultyId: string; role: string }
type Offering = {
  id: string
  classId: string
  code: string
  name: string
  facultyId: string | null
}
type Course = {
  id: string
  code: string
  name: string
  year: string | null
  departmentCode: string | null
}

export function AppointClient({
  faculty,
  classes,
  staff,
  offerings,
  courses,
}: {
  faculty: Faculty[]
  classes: Klass[]
  staff: Staff[]
  offerings: Offering[]
  courses: Course[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [selectedId, setSelectedId] = useState(faculty[0]?.id ?? "")
  const [search, setSearch] = useState("")
  const [addClassId, setAddClassId] = useState("")
  const [courseQuery, setCourseQuery] = useState("")
  const [semester, setSemester] = useState(1)

  const selected = faculty.find((f) => f.id === selectedId) ?? null
  const q = search.trim().toLowerCase()
  const list = faculty.filter(
    (f) => !q || `${f.name} ${f.email}`.toLowerCase().includes(q)
  )

  // What this person already holds: the classes they are on, and within each,
  // the subjects allocated to them. Everything else on the page is an edit to
  // this, so it is shown first rather than as a confirmation afterwards.
  const held = selected
    ? classes
        .filter((c) =>
          staff.some((s) => s.classId === c.id && s.facultyId === selected.id)
        )
        .map((c) => ({
          klass: c,
          roles: staff
            .filter((s) => s.classId === c.id && s.facultyId === selected.id)
            .map((s) => s.role),
          subjects: offerings.filter(
            (o) => o.classId === c.id && o.facultyId === selected.id
          ),
        }))
    : []

  const heldClassIds = new Set(held.map((h) => h.klass.id))
  const addable = selected
    ? classes.filter(
        (c) =>
          !heldClassIds.has(c.id) && c.departmentCode === selected.department
      )
    : []

  function run(fn: () => Promise<{ error: string | null }>, ok: string) {
    start(async () => {
      const res = await fn()
      if (res.error) return void toast.error(res.error)
      toast.success(ok)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search faculty…"
          className="h-9"
        />
        <div className="border-border divide-border max-h-[32rem] divide-y overflow-y-auto rounded border">
          {list.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={cn(
                "hover:bg-muted flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left",
                f.id === selectedId && "bg-muted"
              )}
            >
              <span className="text-sm font-medium">{f.name}</span>
              <span className="text-muted-foreground text-xs">{f.email}</span>
              <span className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {f.tier}
                </Badge>
                {!f.claimed && (
                  <span className="text-destructive text-xs">not claimed</span>
                )}
              </span>
            </button>
          ))}
          {list.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">
              No faculty match that search.
            </p>
          )}
        </div>
      </div>

      {!selected ? (
        <p className="text-muted-foreground text-sm">
          No faculty in this department yet. Add them from the department page
          first.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold">{selected.name}</h2>
            <p className="text-muted-foreground text-xs">
              {selected.email} · {selected.department} · {selected.tier}
            </p>
          </div>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              Classes they are on ({held.length})
            </h3>
            {held.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Not on any class yet. Put them on one below.
              </p>
            ) : (
              held.map((h) => (
                <div key={h.klass.id} className="border-border rounded border">
                  <div className="bg-muted/50 flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="text-sm font-medium">{h.klass.label}</span>
                    {h.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-xs">
                        {r === "academic_coordinator" ? "Coordinator" : "TR"}
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 px-2 text-xs"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            removeClassRoleAction({
                              classId: h.klass.id,
                              facultyId: selected.id,
                              role: h.roles.includes("academic_coordinator")
                                ? "academic_coordinator"
                                : "tr",
                            }),
                          "Removed from the class"
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="divide-border divide-y">
                    {h.subjects.length === 0 ? (
                      <p className="text-muted-foreground px-3 py-2 text-xs">
                        No subjects allocated to them on this class.
                      </p>
                    ) : (
                      h.subjects.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm"
                        >
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {s.code}
                          </Badge>
                          <span className="truncate">{s.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-6 px-2 text-xs"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  assignOfferingFacultyAction({
                                    offeringId: s.id,
                                    facultyId: null,
                                  }),
                                "Subject released"
                              )
                            }
                          >
                            Release
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="border-border flex flex-col gap-3 rounded border p-4">
            <h3 className="text-sm font-semibold">Give them a subject</h3>
            <p className="text-muted-foreground text-xs">
              Choose the division and the subject. They are put on that division
              as a TR if they are not already, and only they can enter its
              marks.
            </p>

            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">Division</span>
                <select
                  value={addClassId}
                  onChange={(e) => setAddClassId(e.target.value)}
                  className="border-input bg-background h-9 rounded border px-2 text-sm"
                >
                  <option value="">Select…</option>
                  {[...held.map((h) => h.klass), ...addable].map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid w-20 gap-1.5">
                <span className="text-muted-foreground text-xs">Semester</span>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="h-9"
                />
              </label>
              <Input
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder="Search the catalogue…"
                className="h-9 max-w-xs"
              />
            </div>

            <div className="border-border divide-border max-h-64 divide-y overflow-y-auto rounded border">
              {courses
                .filter(
                  (c) =>
                    !courseQuery.trim() ||
                    `${c.code} ${c.name}`
                      .toLowerCase()
                      .includes(courseQuery.trim().toLowerCase())
                )
                .slice(0, 60)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                  >
                    <Badge variant="outline" className="font-mono text-xs">
                      {c.code}
                    </Badge>
                    <span className="truncate">{c.name}</span>
                    {c.year && (
                      <span className="text-muted-foreground text-xs">
                        {c.year}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-7 px-2 text-xs"
                      disabled={pending || !addClassId}
                      onClick={() =>
                        run(
                          () =>
                            assignSubjectToTeacherAction({
                              classId: addClassId,
                              facultyId: selected.id,
                              courseId: c.id,
                              semester,
                            }),
                          `${c.code} assigned to ${selected.name}`
                        )
                      }
                    >
                      Assign
                    </Button>
                  </div>
                ))}
            </div>
          </section>

          <section className="border-border flex flex-wrap items-end gap-2 rounded border p-4">
            <div className="flex-1">
              <h3 className="text-sm font-semibold">
                Make them a class coordinator
              </h3>
              <p className="text-muted-foreground text-xs">
                One per class — appointing them replaces whoever holds it now.
                The coordinator approves enrolment and can cover any subject on
                the class.
              </p>
            </div>
            <select
              value={addClassId}
              onChange={(e) => setAddClassId(e.target.value)}
              className="border-input bg-background h-9 rounded border px-2 text-sm"
            >
              <option value="">Select a division…</option>
              {classes
                .filter((c) => c.departmentCode === selected.department)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !addClassId}
              onClick={() =>
                run(
                  () =>
                    assignClassRoleAction({
                      classId: addClassId,
                      facultyId: selected.id,
                      role: "academic_coordinator",
                    }),
                  "Appointed as coordinator"
                )
              }
            >
              Appoint
            </Button>
          </section>
        </div>
      )}
    </div>
  )
}
