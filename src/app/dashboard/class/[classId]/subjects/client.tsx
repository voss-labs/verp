"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createSubjectAction, assignOfferingFacultyAction } from "../../actions"

type Offering = {
  id: string
  code: string
  name: string
  semester: number
  credits: number
  marks: string
  facultyId: string | null
}
type Staff = { facultyId: string; name: string; role: string }
type CatalogueCourse = {
  code: string
  name: string
  type: string
  credits: number
  year: string | null
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
}

const UNALLOCATED = "__none__"

export function SubjectsClient({
  classId,
  canAllocate,
  classYear,
  semesters,
  offerings,
  staff,
  catalogue,
}: {
  classId: string
  canAllocate: boolean
  classYear: string | null
  /** The two semesters this cohort can actually be sitting. */
  semesters: [number, number]
  offerings: Offering[]
  staff: Staff[]
  catalogue: CatalogueCourse[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [query, setQuery] = useState("")
  // Defaulting to 1 filed a BE class's subject three years before that cohort
  // sat it. The class knows which semesters it can be in; the form should not
  // have to be told.
  const [semester, setSemester] = useState(semesters[0])

  function allocate(offeringId: string, facultyId: string) {
    start(async () => {
      const res = await assignOfferingFacultyAction({
        offeringId,
        facultyId: facultyId === UNALLOCATED ? null : facultyId,
      })
      if (res.error) return void toast.error(res.error)
      toast.success(
        facultyId === UNALLOCATED ? "Subject unallocated" : "Subject allocated"
      )
      router.refresh()
    })
  }

  function addFromCatalogue(c: CatalogueCourse) {
    start(async () => {
      const res = await createSubjectAction({
        classId,
        courseCode: c.code,
        courseName: c.name,
        courseType: c.type as "theory" | "practical" | "project",
        credits: c.credits,
        maxIsa: c.maxIsa,
        maxMse: c.maxMse,
        maxEse: c.maxEse,
        maxTotal: c.maxTotal,
        semester,
        facultyId: null,
      })
      if (res.error) return void toast.error(res.error)
      toast.success(`${c.code} added — allocate it to a teacher`)
      router.refresh()
    })
  }

  const q = query.trim().toLowerCase()
  // The class's own year first: a BE class is almost never given an FE subject,
  // but the rest stay reachable rather than hidden, because repeats happen.
  const shortlist = catalogue
    .filter((c) => !q || `${c.code} ${c.name}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const am = a.year === classYear ? 0 : 1
      const bm = b.year === classYear ? 0 : 1
      return am - bm || a.code.localeCompare(b.code)
    })

  const unallocated = offerings.filter((o) => !o.facultyId).length

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Subjects on this class ({offerings.length})
          </h2>
          {unallocated > 0 && (
            <span className="text-destructive text-xs">
              {unallocated} not allocated
            </span>
          )}
        </div>

        {offerings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No subjects yet.{" "}
            {canAllocate
              ? "Add one from the catalogue on the right."
              : "The class coordinator or HOD adds them."}
          </p>
        ) : (
          <div className="border-border overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th className="w-24">Code</th>
                  <th>Subject</th>
                  <th className="w-14">Sem</th>
                  <th className="w-14">Cr</th>
                  <th className="w-28">ISA/MSE/ESE</th>
                  <th className="w-56">Teacher</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {offerings.map((o) => (
                  <tr key={o.id} className="[&>td]:px-3 [&>td]:py-2">
                    <td className="font-mono text-xs">{o.code}</td>
                    <td>{o.name}</td>
                    <td className="tabular-nums">{o.semester}</td>
                    <td className="tabular-nums">{o.credits}</td>
                    <td className="text-muted-foreground text-xs tabular-nums">
                      {o.marks}
                    </td>
                    <td>
                      {canAllocate ? (
                        <select
                          value={o.facultyId ?? UNALLOCATED}
                          disabled={pending}
                          onChange={(e) => allocate(o.id, e.target.value)}
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                        >
                          <option value={UNALLOCATED}>Unallocated</option>
                          {staff.map((s) => (
                            <option key={s.facultyId} value={s.facultyId}>
                              {s.name}
                              {s.role === "academic_coordinator" ? " (AC)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm">
                          {staff.find((s) => s.facultyId === o.facultyId)
                            ?.name ?? (
                            <span className="text-destructive text-xs">
                              Unallocated
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {offerings.length > 0 && (
          <p className="text-muted-foreground text-xs">
            A teacher enters marks for the subjects allocated to them, from{" "}
            <Link
              href={`/dashboard/class/${classId}/marks`}
              className="underline"
            >
              Enter marks
            </Link>
            . Coordinators and the HOD can write any of them, so an absence is
            coverable.
          </p>
        )}
      </div>

      {canAllocate && (
        <div className="border-border flex flex-col gap-3 rounded border p-4">
          <h2 className="text-sm font-semibold">Add from catalogue</h2>
          {catalogue.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Every catalogued subject for this department is already on the
              class. Import a syllabus or add a course to the{" "}
              <Link href="/dashboard/dept/courses" className="underline">
                catalogue
              </Link>{" "}
              first.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <label className="grid flex-1 gap-1.5">
                  <span className="text-muted-foreground text-xs">Search</span>
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Code or name…"
                    className="h-9"
                  />
                </label>
                <label className="grid w-28 gap-1.5">
                  <span className="text-muted-foreground text-xs">
                    Semester
                  </span>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="border-input bg-background h-9 rounded border px-2 text-sm"
                  >
                    {semesters.map((n) => (
                      <option key={n} value={n}>
                        Semester {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="border-border divide-border max-h-[28rem] divide-y overflow-y-auto rounded border">
                {shortlist.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.code}
                        </Badge>
                        {c.year && (
                          <span className="text-muted-foreground text-xs">
                            {c.year}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm">{c.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {c.type} · {c.credits} cr · {c.maxIsa}/{c.maxMse}/
                        {c.maxEse}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => addFromCatalogue(c)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
                {shortlist.length === 0 && (
                  <p className="text-muted-foreground px-3 py-2 text-sm">
                    Nothing matches that search.
                  </p>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Credits and the marks split come from the catalogue, so a
                subject is defined once and taught many times.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
