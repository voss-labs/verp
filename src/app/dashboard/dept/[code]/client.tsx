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
import { Badge } from "@/components/ui/badge"

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
  return (
    <div className="flex flex-col gap-6">
      {!dept.isActive && (
        <p className="border-border text-muted-foreground rounded border px-3 py-2 text-sm">
          This department is deactivated. It is shown for reference; its records
          are not being maintained.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Students"
          value={totals.students}
          hint={`${placed} in a class`}
        />
        <Stat
          label="Faculty"
          value={faculty.length}
          hint={`${faculty.filter((f) => f.claimed).length} signed in`}
        />
        <Stat
          label="Classes"
          value={classes.length}
          hint={`${classes.filter((c) => c.graduated).length} graduated`}
        />
        <Stat
          label="Not signed in"
          value={totals.unclaimedStudents}
          hint="students yet to claim"
          warn={totals.unclaimedStudents > 0}
        />
      </div>

      <Section title="Leadership">
        <div className="grid gap-3 sm:grid-cols-2">
          <Lead role="Head of Department" person={hod} />
          <Lead role="Department coordinator" person={coordinator} />
        </div>
      </Section>

      <Section title={`Classes (${classes.length})`}>
        {classes.length === 0 ? (
          <Empty>No classes yet in this department.</Empty>
        ) : (
          <Table
            head={["Class", "Coordinator", "TR", "Students", "Status", ""]}
            rows={classes.map((c) => [
              <Link
                key="k"
                href={`/dashboard/class/${c.id}`}
                className="hover:underline"
              >
                <span className="font-medium">{c.label}</span>{" "}
                <span className="text-muted-foreground font-mono text-xs">
                  {c.classKey}
                </span>
              </Link>,
              c.coordinator ?? <Unset key="c">Unassigned</Unset>,
              c.trs.length > 0 ? c.trs.join(", ") : <Unset key="t">None</Unset>,
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

      <Section title={`Faculty (${faculty.length})`}>
        {faculty.length === 0 ? (
          <Empty>No faculty on record for this department.</Empty>
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
                <Unset key="r">—</Unset>
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

      {assigning && (
        <AssignSubjectDialog
          teacher={assigning}
          courses={courses}
          classOptions={classOptions}
          onClose={() => setAssigning(null)}
        />
      )}

      {totals.unplaced > 0 && (
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
              <span key="r" className="font-mono text-xs">
                {s.rollNumber}
              </span>,
              s.name,
              s.year,
              s.classKey ? (
                <span key="k" className="font-mono text-xs">
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

function Stat({
  label,
  value,
  hint,
  warn,
}: {
  label: string
  value: number
  hint: string
  warn?: boolean
}) {
  return (
    <div className="border-border rounded border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p
        className={
          warn ? "text-destructive text-xs" : "text-muted-foreground text-xs"
        }
      >
        {hint}
      </p>
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
        <p className="text-destructive text-sm">Not appointed</p>
      )}
    </div>
  )
}

function Unset({ children }: { children: React.ReactNode }) {
  return <span className="text-destructive text-xs">{children}</span>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
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
                  <Badge variant="outline" className="font-mono text-xs">
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
