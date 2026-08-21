"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { assignSubjectToTeacherAction } from "../actions"
import { DeptTabs } from "./dept-tabs"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { LayersIcon, UsersIcon } from "lucide-react"

type Person = { name: string; email: string }
type ClassRow = {
  id: string
  classKey: string
  label: string
  isActive: boolean
  graduated: boolean
  coordinator: string | null
  trs: string[]
  students: number
  unclaimed: number
}
type FacultyRow = {
  id: string
  name: string
  email: string
  tier: string
  classRoles: string[]
  claimed: boolean
}

type Course = { id: string; code: string; name: string; year: string | null }
type ClassOption = { id: string; label: string }

export function DeptDashboardClient({
  section,
  canAssign,
  courses,
  classOptions,
  dept,
  hod,
  coordinator,
  classes,
  faculty,
  totals,
  unplaced,
}: {
  section: string
  canAssign: boolean
  courses: Course[]
  classOptions: ClassOption[]
  dept: { code: string; name: string; isActive: boolean }
  hod: Person | null
  coordinator: Person | null
  classes: ClassRow[]
  faculty: FacultyRow[]
  totals: { students: number; unclaimedStudents: number; unplaced: number }
  unplaced: {
    id: string
    rollNumber: string
    name: string
    classKey: string | null
    year: string
  }[]
}) {
  const [assigning, setAssigning] = useState<FacultyRow | null>(null)
  const placed = totals.students - totals.unplaced
  // Sections rather than one long scroll. A real department puts leadership,
  // classes, faculty and the unplaced list on the same page, and the thing you
  // came for is never in view.
  const sections = [
    { key: "overview", label: "Overview" },
    {
      key: "classes",
      label: "Classes",
      badge: classes.filter((c) => !c.coordinator).length,
    },
    { key: "faculty", label: "Faculty" },
    { key: "students", label: "Students", badge: totals.unplaced },
  ]
  const show = (k: string) => section === k
  return (
    <div className="flex flex-col gap-6">
      <DeptTabs sections={sections} code={dept.code} />

      {!dept.isActive && (
        <p className="border-border text-muted-foreground rounded border px-3 py-2 text-sm">
          This department is deactivated. It is shown for reference; its records
          are not being maintained.
        </p>
      )}

      {show("overview") && (
        <StatCardRow>
          <StatCard
            label="Students"
            value={totals.students}
            detail={`${placed} in a class`}
          />
          <StatCard
            label="Faculty"
            value={faculty.length}
            detail={`${faculty.filter((f) => f.claimed).length} signed in`}
          />
          <StatCard
            label="Classes"
            value={classes.length}
            detail={`${classes.filter((c) => c.graduated).length} graduated`}
          />
          <StatCard
            label="Not signed in"
            value={totals.unclaimedStudents}
            detail="students yet to claim"
            tone={totals.unclaimedStudents > 0 ? "attention" : "default"}
          />
        </StatCardRow>
      )}

      {show("overview") && (
        <Section title="Leadership">
          <div className="grid gap-3 sm:grid-cols-2">
            <Lead role="Head of Department" person={hod} />
            <Lead role="Department coordinator" person={coordinator} />
          </div>
        </Section>
      )}

      {(show("overview") || show("classes")) && (
        <Section title={`Classes (${classes.length})`}>
          {classes.length === 0 ? (
            <EmptyState
              icon={LayersIcon}
              variant="dashed"
              title="No classes yet"
              description="Cohorts appear here once they are created in My department."
            />
          ) : (
            <Table
              head={[
                "Class",
                "Coordinator",
                "Teacher (TR)",
                "Students",
                "Status",
                "",
              ]}
              rows={classes.map((c) => [
                <Link
                  key="k"
                  href={`/dashboard/class/${c.id}`}
                  className="text-blue underline-offset-2 hover:underline"
                >
                  <span className="font-medium">{c.label}</span>{" "}
                  <span className="text-muted-foreground identifier">
                    {c.classKey}
                  </span>
                </Link>,
                c.coordinator ?? <Unset key="c">Unassigned</Unset>,
                c.trs.length > 0 ? (
                  c.trs.join(", ")
                ) : (
                  <Unset key="t">None</Unset>
                ),
                <span key="s" className="tabular-nums">
                  {c.students}
                  {c.unclaimed > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {" "}
                      ({c.unclaimed} not signed in)
                    </span>
                  )}
                </span>,
                c.graduated ? (
                  <Badge key="g" variant="secondary">
                    Graduated
                  </Badge>
                ) : c.isActive ? (
                  <Badge key="g" variant="outline">
                    Active
                  </Badge>
                ) : (
                  <Badge key="g" variant="secondary">
                    Inactive
                  </Badge>
                ),
              ])}
            />
          )}
        </Section>
      )}

      {(show("overview") || show("faculty")) && (
        <Section title={`Faculty (${faculty.length})`}>
          {faculty.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              variant="dashed"
              title="No faculty on record"
              description="Add them from My department, or run a faculty import."
            />
          ) : (
            <Table
              head={[
                "Name",
                "Email",
                "Tier",
                "Class role",
                "Account",
                ...(canAssign ? [""] : []),
              ]}
              rows={faculty.map((f) => [
                f.name,
                <span key="e" className="text-muted-foreground text-xs">
                  {f.email}
                </span>,
                <Badge key="t" variant="outline">
                  {f.tier}
                </Badge>,
                f.classRoles.length > 0 ? (
                  f.classRoles.join(" · ")
                ) : (
                  <span key="r" className="text-muted-foreground text-xs">
                    —
                  </span>
                ),
                f.claimed ? (
                  <span key="a" className="text-muted-foreground text-xs">
                    Signed in
                  </span>
                ) : (
                  <Unset key="a">Not claimed</Unset>
                ),
              ])}
            />
          )}
        </Section>
      )}

      {assigning && (
        <AssignSubjectDialog
          teacher={assigning}
          courses={courses}
          classOptions={classOptions}
          onClose={() => setAssigning(null)}
        />
      )}

      {(show("overview") || show("students")) && totals.unplaced > 0 && (
        <Section title={`Not in any class (${totals.unplaced})`}>
          <p className="text-muted-foreground mb-3 text-sm">
            These students belong to the department but their cohort has no
            class row yet, so they appear on no class roster and no coordinator
            can act on them. Creating the matching class puts them in place —
            membership is derived from the roll number, so nothing needs
            re-importing.
          </p>
          <Table
            head={["Roll", "Name", "Year", "Cohort key"]}
            rows={unplaced.map((s) => [
              <span key="r" className="identifier">
                {s.rollNumber}
              </span>,
              s.name,
              s.year,
              s.classKey ? (
                <span key="k" className="identifier">
                  {s.classKey}
                </span>
              ) : (
                <Unset key="k">Roll did not parse</Unset>
              ),
            ])}
          />
          {totals.unplaced > unplaced.length && (
            <p className="text-muted-foreground mt-2 text-xs">
              Showing the first {unplaced.length} of {totals.unplaced}.
            </p>
          )}
        </Section>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function Lead({ role, person }: { role: string; person: Person | null }) {
  return (
    <div className="border-border rounded border p-3">
      <p className="text-muted-foreground text-xs">{role}</p>
      {person ? (
        <>
          <p className="text-sm font-medium">{person.name}</p>
          <p className="text-muted-foreground text-xs">{person.email}</p>
        </>
      ) : (
        <p className="text-attention text-sm">Not appointed</p>
      )}
    </div>
  )
}

function Unset({ children }: { children: React.ReactNode }) {
  return <span className="text-attention text-xs">{children}</span>
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="border-border overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="[&>td]:px-3 [&>td]:py-2">
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AssignSubjectDialog({
  teacher,
  courses,
  classOptions,
  onClose,
}: {
  teacher: FacultyRow
  courses: Course[]
  classOptions: ClassOption[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [classId, setClassId] = useState(classOptions[0]?.id ?? "")
  const [courseId, setCourseId] = useState("")
  const [semester, setSemester] = useState(1)
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const shortlist = courses.filter(
    (c) => !q || `${c.code} ${c.name}`.toLowerCase().includes(q)
  )

  function save() {
    start(async () => {
      const res = await assignSubjectToTeacherAction({
        classId,
        facultyId: teacher.id,
        courseId,
        semester,
      })
      if (res.error) return void toast.error(res.error)
      toast.success(`Assigned to ${teacher.name}`)
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a subject to {teacher.name}</DialogTitle>
        </DialogHeader>

        {classOptions.length === 0 || courses.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {classOptions.length === 0
              ? "This department has no active classes yet."
              : "This department has no catalogued courses yet."}
          </p>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">Division</span>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="border-input bg-background h-9 rounded border px-2 text-sm"
                >
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
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
            </div>

            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs">Subject</span>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the catalogue…"
                className="h-9"
              />
            </label>

            <div className="border-border divide-border max-h-64 divide-y overflow-y-auto rounded border">
              {shortlist.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourseId(c.id)}
                  className={
                    "hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left text-sm " +
                    (courseId === c.id ? "bg-muted" : "")
                  }
                >
                  <Badge variant="outline" className="identifier">
                    {c.code}
                  </Badge>
                  <span className="truncate">{c.name}</span>
                  {c.year && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {c.year}
                    </span>
                  )}
                </button>
              ))}
              {shortlist.length === 0 && (
                <p className="text-muted-foreground px-3 py-2 text-sm">
                  Nothing matches that search.
                </p>
              )}
            </div>

            <p className="text-muted-foreground text-xs">
              They are put on the division as a TR if they are not already, then
              given this subject. Only they can enter its marks.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            size="sm"
            disabled={pending || !classId || !courseId}
            onClick={save}
          >
            {pending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
