"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { computeMarks, type CgpaResult, type CourseInfo } from "@/lib/sgpi"

type Subject = {
  code: string
  name: string
  credits: number
  marks: {
    isa: number | null
    mse1: number | null
    mse2: number | null
    ese: number | null
  }
  course: CourseInfo
}
type Semester = { semester: number; subjects: Subject[] }

export function MyMarksClient({
  cgpa,
  semesters,
  awaiting,
  attendance,
}: {
  cgpa: CgpaResult
  semesters: Semester[]
  attendance: {
    offeringId: string | null
    code: string
    name: string
    present: number
    total: number
    percent: number | null
  }[]
  awaiting: { code: string; name: string; semester: number }[]
}) {
  if (semesters.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          {awaiting.length > 0
            ? "No results have been published yet."
            : "No marks recorded yet. They appear here once your teachers enter them."}
        </p>
        <SubjectAttendance rows={attendance} />
        <AwaitingPublication subjects={awaiting} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="CGPA"
          // A fail anywhere makes an aggregate misleading rather than merely
          // low, so it is withheld instead of quietly averaged away.
          value={cgpa.hasFail ? "—" : (cgpa.cgpa?.toFixed(2) ?? "—")}
          hint={
            cgpa.hasFail
              ? "pending a re-attempt"
              : `${cgpa.totalCredits} credits`
          }
        />
        <Stat
          label="Semesters"
          value={String(cgpa.completedSemesters)}
          hint="completed"
        />
        <Stat
          label="Credit points"
          value={String(cgpa.totalCreditPoints)}
          hint="earned"
        />
      </div>

      <SubjectAttendance rows={attendance} />
      <AwaitingPublication subjects={awaiting} />

      {semesters.map((sem) => {
        const result = cgpa.perSemester.find((p) => p.semester === sem.semester)
        return (
          <Card key={sem.semester}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Semester {sem.semester}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">SGPI</span>
                <Badge
                  variant={result?.sgpi.hasFail ? "destructive" : "outline"}
                >
                  {result?.sgpi.hasFail
                    ? "Fail"
                    : (result?.sgpi.sgpi?.toFixed(2) ?? "—")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-xs">
                    <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
                      <th>Code</th>
                      <th>Subject</th>
                      <th className="w-16">Credits</th>
                      <th className="w-16">ISA</th>
                      <th className="w-16">MSE</th>
                      <th className="w-16">ESE</th>
                      <th className="w-20">Total</th>
                      <th className="w-14">%</th>
                      <th className="w-16">Grade</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {sem.subjects.map((s) => (
                      <SubjectRow key={s.code} subject={s} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="border-border rounded border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  )
}

/**
 * A subject, expandable to the component marks behind its total.
 *
 * A student checking against their own answer sheet needs ISA, both MSEs and
 * the ESE separately — a single total says what they scored but not where, and
 * "why is my total 62" is the actual question. Collapsed by default so a full
 * semester still reads at a glance, and only expandable once something has been
 * entered, since an empty breakdown answers nothing.
 */
function SubjectRow({ subject }: { subject: Subject }) {
  const [open, setOpen] = useState(false)
  const c = computeMarks(subject.marks, subject.course)
  const hasMse = subject.course.maxMse > 0
  const entered =
    subject.marks.isa != null ||
    subject.marks.mse1 != null ||
    subject.marks.mse2 != null ||
    subject.marks.ese != null

  return (
    <>
      <tr
        className={cn(
          "[&>td]:px-2 [&>td]:py-1.5",
          entered && "hover:bg-muted/50 cursor-pointer"
        )}
        onClick={() => entered && setOpen((o) => !o)}
      >
        <td className="font-mono text-xs">{subject.code}</td>
        <td>{subject.name}</td>
        <td className="tabular-nums">{subject.credits}</td>
        {/* The components sit in the row rather than behind the expander: a
            student checking a marksheet wants ISA and MSE at a glance, and
            opening every subject to find them was the slow way round. */}
        <Cell value={subject.marks.isa} max={subject.course.maxIsa} />
        <Cell
          value={hasMse ? c.finalMse : null}
          max={subject.course.maxMse}
          absent={!hasMse}
        />
        <Cell value={subject.marks.ese} max={subject.course.maxEse} />
        <td className="tabular-nums">
          {c.percentage == null ? "—" : `${c.total}/${subject.course.maxTotal}`}
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
        <td className="text-muted-foreground text-xs">
          {entered ? (open ? "▾" : "▸") : ""}
        </td>
      </tr>

      {open && (
        <tr className="bg-muted/30">
          <td colSpan={10} className="px-2 py-3">
            <div className="flex flex-wrap items-start gap-6 text-xs">
              <Part
                label="ISA"
                value={subject.marks.isa}
                max={subject.course.maxIsa}
              />
              {hasMse && (
                <>
                  <Part
                    label="MSE 1"
                    value={subject.marks.mse1}
                    max={subject.course.maxMse}
                  />
                  <Part
                    label="MSE 2"
                    value={subject.marks.mse2}
                    max={subject.course.maxMse}
                  />
                  {/* The two MSEs average into one component, so the figure that
                      actually enters the total is shown rather than leaving the
                      arithmetic looking wrong. */}
                  <Part
                    label="MSE counted"
                    value={c.finalMse}
                    max={subject.course.maxMse}
                  />
                </>
              )}
              <Part
                label="ESE"
                value={subject.marks.ese}
                max={subject.course.maxEse}
              />
              <div className="ml-auto text-right">
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium tabular-nums">
                  {c.total}/{subject.course.maxTotal}
                </p>
              </div>
            </div>
            {c.percentage == null && (
              <p className="text-muted-foreground mt-3">
                Not every component is in yet, so no grade is calculated. This
                is what your teachers have entered so far.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function Part({
  label,
  value,
  max,
}: {
  label: string
  value: number | null
  max: number
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">
        {value == null ? (
          <span className="text-muted-foreground font-normal">not entered</span>
        ) : (
          `${value}/${max}`
        )}
      </p>
    </div>
  )
}

/**
 * Subjects a student is taking whose results are not published.
 *
 * Naming them matters: silence looks like the subject was forgotten, and a
 * student who can see four of their six subjects will assume the other two are
 * lost rather than pending. Marks are deliberately not shown — an unpublished
 * figure is not a result, and showing it would make publication meaningless.
 */
function AwaitingPublication({
  subjects,
}: {
  subjects: { code: string; name: string; semester: number }[]
}) {
  if (subjects.length === 0) return null
  return (
    <div className="border-border rounded border p-4">
      <p className="text-sm font-medium">Awaiting publication</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Your teachers are still entering or finalising these. They appear with a
        grade once the class coordinator publishes them.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {subjects.map((s) => (
          <li key={s.code} className="flex items-center gap-2 text-sm">
            <span className="identifier">{s.code}</span>
            <span className="truncate">{s.name}</span>
            <span className="text-muted-foreground ml-auto text-xs">
              Semester {s.semester}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * One component's mark against its maximum.
 *
 * A blank is not a zero: "not entered" and "scored nothing" look identical as a
 * bare 0, and a student reading their own marksheet must be able to tell them
 * apart. A component the course does not have shows as a dash rather than an
 * empty gap that reads like missing data.
 */
function Cell({
  value,
  max,
  absent,
}: {
  value: number | null
  max: number
  absent?: boolean
}) {
  if (absent) {
    return <td className="text-muted-foreground text-xs">—</td>
  }
  return (
    <td className="tabular-nums">
      {value == null ? (
        <span className="text-muted-foreground text-xs">not entered</span>
      ) : (
        <>
          {value}
          <span className="text-muted-foreground text-xs">/{max}</span>
        </>
      )}
    </td>
  )
}

/**
 * Attendance per subject, with the 75% rule stated where it applies.
 *
 * A single overall percentage cannot answer the question a student actually
 * has, because the rule is enforced per subject: 80% overall hides a subject
 * sitting at 60%, and the student finds out when they are barred from the exam.
 */
function SubjectAttendance({
  rows,
}: {
  rows: {
    offeringId: string | null
    code: string
    name: string
    present: number
    total: number
    percent: number | null
  }[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="border-border rounded border p-4">
      <p className="text-sm font-medium">Attendance</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        VIT requires 75% in each subject. Late counts as present.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => {
          const short = r.percent != null && r.percent < 75
          return (
            <li
              key={r.offeringId ?? "class"}
              className="flex items-center gap-2 text-sm"
            >
              <span className="identifier">{r.code}</span>
              <span className="truncate">{r.name}</span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                {r.present}/{r.total}
              </span>
              <span
                className={
                  short
                    ? "text-destructive w-16 shrink-0 text-right text-sm font-medium tabular-nums"
                    : "w-16 shrink-0 text-right text-sm font-medium tabular-nums"
                }
              >
                {r.percent == null ? "—" : `${r.percent}%`}
                {/* The number alone is not the warning — colour never carries
                    meaning by itself. */}
              </span>
              {short && (
                <span className="text-destructive shrink-0 text-xs">Short</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
