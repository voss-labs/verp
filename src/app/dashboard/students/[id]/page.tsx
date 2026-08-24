import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  CalendarCheckIcon,
  ChevronRightIcon,
  GraduationCapIcon,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { BatchChip } from "@/components/batch-chip"
import { RecordHistory } from "@/components/record-history"
import { SubjectResultCells } from "@/components/subject-result"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  getStudentById,
  getStudentProfile,
  type StudentProfileSubject,
} from "@/db/queries/students"
import { getSessionUser } from "@/lib/session"
import { currentYear, expectedYear } from "@/lib/roll-number"
import {
  computeCgpa,
  groupBySemester,
  type CourseInfo,
  type MarksInput,
  type SemesterResult,
} from "@/lib/sgpi"
import { can } from "@/lib/rbac"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type SubjectRow = {
  code: string
  name: string
  credits: number
  course: CourseInfo
  marks: MarksInput | null
}

type AttendanceRow = {
  offeringId: string | null
  code: string
  name: string
  batch: string | null
  present: number
  total: number
  percent: number | null
}

function courseInfo(s: StudentProfileSubject): CourseInfo {
  return {
    courseType: s.courseType,
    credits: s.credits,
    maxIsa: s.maxIsa,
    maxMse: s.maxMse,
    maxEse: s.maxEse,
    maxTotal: s.maxTotal,
  }
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "student:read")) redirect("/dashboard")

  const student = await getStudentById(id)
  if (!student) return notFound()

  // Scope: the record must be within the viewer's reach — their class (coordinator)
  // or department (HOD); super_admin sees any.
  const inScope =
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(student.department)) ||
    (!!student.classKey && user.classKeys.includes(student.classKey))
  if (!inScope) redirect("/dashboard/students")

  const profile = await getStudentProfile({
    id: student.id,
    classKey: student.classKey,
  })

  const studentName = `${student.firstName} ${student.lastName}`.trim()
  const claimed = student.authUserId !== null
  const initials = (
    (student.firstName[0] ?? "") + (student.lastName[0] ?? "")
  ).toUpperCase()
  const year = currentYear(
    student.rollNumber,
    student.year,
    new Date(),
    student.graduatedAt
  )

  const cls = profile.class
  const classLabel = cls
    ? `${expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear} · ${cls.departmentCode} · ${cls.division}`
    : null
  const canReachClass =
    cls != null &&
    (user.tier === "super_admin" ||
      (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode)) ||
      user.classIds.includes(cls.id))

  const published = profile.subjects.filter((s) => s.published)
  const cgpa = computeCgpa(
    groupBySemester(
      published.map((s) => ({
        semester: s.semester,
        marks: { isa: s.isa, mse1: s.mse1, mse2: s.mse2, ese: s.ese },
        course: courseInfo(s),
      }))
    )
  )

  const bySemester = new Map<number, SubjectRow[]>()
  for (const s of profile.subjects) {
    const list = bySemester.get(s.semester) ?? []
    list.push({
      code: s.code,
      name: s.name,
      credits: s.credits,
      course: courseInfo(s),
      marks: s.published
        ? { isa: s.isa, mse1: s.mse1, mse2: s.mse2, ese: s.ese }
        : null,
    })
    bySemester.set(s.semester, list)
  }
  const semesters = [...bySemester.entries()].sort((a, b) => a[0] - b[0])

  const attended = profile.attendance.reduce((sum, r) => sum + r.present, 0)
  const sessions = profile.attendance.reduce((sum, r) => sum + r.total, 0)
  const attendance =
    sessions > 0 ? Math.round((attended / sessions) * 100) : null

  return (
    <>
      <PageHeader
        title={studentName}
        trail={[{ label: "Students" }]}
        parent="All students"
        parentHref="/dashboard/students"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4">
            <section className="bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 rounded-lg p-5 ring-1">
              <div className="flex items-center gap-4">
                <div className="bg-primary text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded-lg text-lg font-semibold">
                  {initials || "?"}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight">
                    {studentName}
                  </h2>
                  <p className="identifier text-muted-foreground">
                    {student.rollNumber}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant="secondary"
                  className={
                    student.isActive
                      ? "bg-success/10 text-success"
                      : "bg-attention/10 text-attention"
                  }
                >
                  {student.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge
                  variant="secondary"
                  className={
                    claimed
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {claimed ? "Claimed" : "Pending"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm break-all">
                {student.email ?? "No email on record"}
              </p>
              {cls && classLabel && (
                <ClassLink
                  href={canReachClass ? `/dashboard/class/${cls.id}` : null}
                  label={classLabel}
                  classKey={cls.classKey}
                />
              )}
            </section>

            <AttendanceTable rows={profile.attendance} />

            {can(user, "audit:read") && (
              <Collapsible className="group/history bg-card overflow-hidden rounded-lg border">
                <CollapsibleTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted/40 flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium transition-colors">
                  <ChevronRightIcon className="size-3.5 transition-transform duration-200 group-data-open/history:rotate-90" />
                  Record history
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t p-3">
                  <RecordHistory targetType="student" targetId={student.id} />
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <StatCardRow className="lg:grid-cols-3">
              <StatCard label="Department" value={student.department} />
              <StatCard label="Division" value={student.division ?? "—"} />
              <StatCard label="Year" value={year} />
              <StatCard
                label="Attendance"
                value={attendance == null ? "—" : `${attendance}%`}
                tone={
                  attendance != null && attendance < 75
                    ? "attention"
                    : "default"
                }
                detail={
                  sessions === 0
                    ? "No sessions recorded"
                    : `${attended} of ${sessions} sessions`
                }
              />
              {published.length > 0 && (
                <StatCard
                  label="CGPA"
                  value={cgpa.hasFail ? "—" : (cgpa.cgpa?.toFixed(2) ?? "—")}
                  detail={
                    cgpa.hasFail
                      ? "Withheld pending a re-attempt"
                      : `Across ${cgpa.totalCredits} credits`
                  }
                />
              )}
            </StatCardRow>

            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold">Marks</h2>
              {semesters.length === 0 ? (
                <EmptyState
                  icon={GraduationCapIcon}
                  variant="dashed"
                  title="No marks recorded yet"
                  description="Subjects appear here once a teacher enters marks against this student."
                />
              ) : (
                semesters.map(([semester, rows]) => (
                  <SemesterBlock
                    key={semester}
                    semester={semester}
                    rows={rows}
                    sgpi={cgpa.perSemester.find((p) => p.semester === semester)}
                  />
                ))
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

function ClassLink({
  href,
  label,
  classKey,
}: {
  href: string | null
  label: string
  classKey: string
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="text-muted-foreground block text-xs font-medium">
          Class
        </span>
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="identifier text-muted-foreground block">
          {classKey}
        </span>
      </span>
      {href && (
        <ChevronRightIcon
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden
        />
      )}
    </>
  )

  if (!href) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        {body}
      </div>
    )
  }

  return (
    <Link
      href={href}
      className="hover:bg-muted/40 focus-visible:ring-ring/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors outline-none focus-visible:ring-2"
    >
      {body}
    </Link>
  )
}

function SemesterBlock({
  semester,
  rows,
  sgpi,
}: {
  semester: number
  rows: SubjectRow[]
  sgpi: SemesterResult | undefined
}) {
  const failed = sgpi?.sgpi.hasFail === true

  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Semester {semester}</h3>
        <Badge variant={failed ? "destructive" : "outline"}>
          {failed
            ? "SGPI withheld"
            : `SGPI ${sgpi?.sgpi.sgpi?.toFixed(2) ?? "—"}`}
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-sm">
          <thead>
            <tr className="text-muted-foreground [&>th]:bg-surface [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:whitespace-nowrap [&>th]:shadow-[inset_0_-1px_0_var(--border)]">
              <th className="w-20">Code</th>
              <th>Subject</th>
              <th className="w-14">Credits</th>
              <th className="w-16">ISA</th>
              <th className="w-16">MSE 1</th>
              <th className="w-16">MSE 2</th>
              <th className="w-16">ESE</th>
              <th className="w-20">Total</th>
              <th className="w-12">%</th>
              <th className="w-24">Grade</th>
              <th className="w-44">State</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((row) =>
              row.marks ? (
                <MarksRow key={row.code} row={row} marks={row.marks} />
              ) : (
                <AwaitingRow key={row.code} row={row} />
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MarksRow({ row, marks }: { row: SubjectRow; marks: MarksInput }) {
  const hasMse = row.course.maxMse > 0

  return (
    <tr className="[&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap">
      <td className="identifier">{row.code}</td>
      <td className="max-w-[18rem] truncate whitespace-normal">{row.name}</td>
      <td className="tabular-nums">{row.credits}</td>
      <ComponentCell value={marks.isa} max={row.course.maxIsa} />
      <ComponentCell
        value={hasMse ? marks.mse1 : null}
        max={row.course.maxMse}
      />
      <ComponentCell
        value={hasMse ? marks.mse2 : null}
        max={row.course.maxMse}
      />
      <ComponentCell value={marks.ese} max={row.course.maxEse} />
      <SubjectResultCells marks={marks} course={row.course} />
      <td>
        <Badge variant="outline" className="text-success font-normal">
          Published
        </Badge>
      </td>
    </tr>
  )
}

function AwaitingRow({ row }: { row: SubjectRow }) {
  return (
    <tr className="[&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap">
      <td className="identifier">{row.code}</td>
      <td className="max-w-[18rem] truncate whitespace-normal">{row.name}</td>
      <td className="tabular-nums">{row.credits}</td>
      {Array.from({ length: 7 }, (_, i) => (
        <td key={i} className="text-muted-foreground">
          —
        </td>
      ))}
      <td>
        <Badge variant="outline" className="text-muted-foreground font-normal">
          Awaiting publication
        </Badge>
      </td>
    </tr>
  )
}

function ComponentCell({ value, max }: { value: number | null; max: number }) {
  if (max <= 0) {
    return <td className="text-muted-foreground">—</td>
  }
  return (
    <td className="identifier">
      {value == null ? <span className="text-muted-foreground">—</span> : value}
      <span className="text-muted-foreground">/{max}</span>
    </td>
  )
}

function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Attendance</h2>
        <p className="text-muted-foreground text-xs">
          VIT requires 75% in each subject. Late counts as present.
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheckIcon}
          title="No sessions recorded"
          description="Per-subject attendance appears here once a register is taken."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground [&>th]:bg-surface [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:whitespace-nowrap [&>th]:shadow-[inset_0_-1px_0_var(--border)]">
                <th className="w-20">Code</th>
                <th>Subject</th>
                <th className="w-20">Sessions</th>
                <th className="w-28">Standing</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((r) => {
                const short = r.percent != null && r.percent < 75
                return (
                  <tr
                    key={r.offeringId ?? "class"}
                    className="[&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap"
                  >
                    <td className="identifier">{r.code}</td>
                    <td className="max-w-[14rem] truncate whitespace-normal">
                      {r.name}
                      {r.batch && (
                        <BatchChip name={r.batch} className="ml-1.5" />
                      )}
                    </td>
                    <td className="identifier">
                      {r.present}
                      <span className="text-muted-foreground">/{r.total}</span>
                    </td>
                    <td
                      className={cn(
                        "font-medium tabular-nums",
                        short && "text-attention"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        {r.percent == null ? "—" : `${r.percent}%`}
                        {short && (
                          <Badge
                            variant="outline"
                            className="text-attention font-normal"
                          >
                            Short
                          </Badge>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
