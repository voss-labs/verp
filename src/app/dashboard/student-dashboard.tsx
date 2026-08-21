import {
  CalendarCheckIcon,
  CircleCheckIcon,
  GraduationCapIcon,
} from "lucide-react"

import { DashGrid, DashPanel } from "@/components/dash-panel"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { getAttendanceBySubject } from "@/db/queries/attendance"
import { getMarksForStudent } from "@/db/queries/marks"
import type { SessionUser } from "@/lib/session"
import {
  computeCgpa,
  computeMarks,
  groupBySemester,
  marksState,
  type MarksState,
} from "@/lib/sgpi"
import { cn } from "@/lib/utils"
import { Completion } from "./overview-cards"

const MARKS_HREF = "/dashboard/my-marks"
const THRESHOLD = 75

type AttendanceRow = Awaited<ReturnType<typeof getAttendanceBySubject>>[number]

type Snapshot = {
  code: string
  name: string
  published: boolean
  state: MarksState
  total: number
  maxTotal: number
  gradePoint: number | "Fail" | null
}

type AwaitingRow = { code: string; name: string; semester: number }

export async function StudentDashboard({ user }: { user: SessionUser }) {
  const studentId = user.studentId
  if (!studentId) {
    return (
      <>
        <PageHeader title="Overview" />
        <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
          <EmptyState
            variant="dashed"
            icon={GraduationCapIcon}
            title="No student record is linked to this account"
            description="Ask your class coordinator to link your roll number, then your attendance and results appear here."
          />
        </div>
      </>
    )
  }

  const [rows, attendance] = await Promise.all([
    getMarksForStudent(studentId),
    getAttendanceBySubject(studentId),
  ])

  const published = rows.filter((m) => m.courseOffering.publishedAt != null)
  const unpublished = rows.filter((m) => m.courseOffering.publishedAt == null)

  const cgpa = computeCgpa(
    groupBySemester(
      published.map((m) => ({
        semester: m.courseOffering.semester,
        marks: { isa: m.isa, mse1: m.mse1, mse2: m.mse2, ese: m.ese },
        course: m.courseOffering.course,
      }))
    )
  )

  const sessions = attendance.reduce((sum, r) => sum + r.total, 0)
  const attended = attendance.reduce((sum, r) => sum + r.present, 0)
  const overall = sessions > 0 ? Math.round((attended / sessions) * 100) : null
  const shortOverall = overall != null && overall < THRESHOLD

  const bars = [...attendance].sort(
    (a, b) => (a.percent ?? 101) - (b.percent ?? 101)
  )

  const latestSgpi = cgpa.perSemester.at(-1)
  const graded = published.filter(
    (m) => marksState(m, m.courseOffering.course) === "graded"
  ).length
  const inProgress = rows.length - graded

  const semesters = rows.map((m) => m.courseOffering.semester)
  const latest = semesters.length > 0 ? Math.max(...semesters) : null

  const snapshot: Snapshot[] = [
    ...published
      .filter((m) => m.courseOffering.semester === latest)
      .map((m) => {
        const course = m.courseOffering.course
        const computed = computeMarks(m, course)
        return {
          code: course.courseCode,
          name: course.courseName,
          published: true,
          state: marksState(m, course),
          total: computed.total,
          maxTotal: course.maxTotal,
          gradePoint: computed.gradePoint,
        }
      }),
    ...unpublished
      .filter((m) => m.courseOffering.semester === latest)
      .map((m) => ({
        code: m.courseOffering.course.courseCode,
        name: m.courseOffering.course.courseName,
        published: false,
        state: "empty" as const,
        total: 0,
        maxTotal: m.courseOffering.course.maxTotal,
        gradePoint: null,
      })),
  ].sort((a, b) => a.code.localeCompare(b.code))

  const snapshotGraded = snapshot.filter(
    (r) => r.published && r.state === "graded"
  ).length

  const awaiting: AwaitingRow[] = unpublished
    .map((m) => ({
      code: m.courseOffering.course.courseCode,
      name: m.courseOffering.course.courseName,
      semester: m.courseOffering.semester,
    }))
    .sort((a, b) => b.semester - a.semester || a.code.localeCompare(b.code))

  return (
    <>
      <PageHeader title="Overview" />
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {user.name || user.email}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Your attendance, your results, and what is still to come.
          </p>
        </div>

        <StatCardRow className="sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Attendance"
            value={overall == null ? "—" : `${overall}%`}
            tone={shortOverall ? "attention" : "default"}
            href={MARKS_HREF}
            detail={
              shortOverall
                ? "VIT requires 75%"
                : sessions === 0
                  ? "No sessions recorded"
                  : `${attended} of ${sessions} sessions`
            }
          />
          <StatCard
            label="SGPI"
            value={
              latestSgpi == null || latestSgpi.sgpi.hasFail
                ? "—"
                : (latestSgpi.sgpi.sgpi?.toFixed(2) ?? "—")
            }
            href={MARKS_HREF}
            detail={
              latestSgpi == null
                ? "Appears once results are published"
                : latestSgpi.sgpi.hasFail
                  ? `Semester ${latestSgpi.semester} withheld pending a re-attempt`
                  : latestSgpi.sgpi.sgpi == null
                    ? `Semester ${latestSgpi.semester} still in progress`
                    : `Semester ${latestSgpi.semester} · ${latestSgpi.sgpi.totalCredits} credits`
            }
          />
          <StatCard
            label="CGPA"
            value={cgpa.hasFail ? "—" : (cgpa.cgpa?.toFixed(2) ?? "—")}
            href={MARKS_HREF}
            detail={
              cgpa.hasFail
                ? "Withheld pending a re-attempt"
                : `Across ${cgpa.totalCredits} credits`
            }
          />
          <StatCard
            label="Credit points"
            value={String(cgpa.totalCreditPoints)}
            href={MARKS_HREF}
            detail="Earned so far"
          />
          <StatCard
            label="Subjects in progress"
            value={String(inProgress)}
            href={MARKS_HREF}
            detail={
              rows.length === 0
                ? "No subjects yet"
                : `${graded} of ${rows.length} graded`
            }
          />
        </StatCardRow>

        <DashGrid>
          <DashPanel
            title="Attendance by subject"
            description="VIT requires 75% in each subject. Late counts as present."
            href={MARKS_HREF}
            hrefLabel="Open my marks"
            className="lg:col-span-7 lg:row-span-2"
          >
            {bars.length === 0 ? (
              <EmptyState
                icon={CalendarCheckIcon}
                title="No sessions recorded"
                description="Your attendance appears here once your teachers start recording sessions."
              />
            ) : (
              <ul className="flex flex-col gap-3.5">
                {bars.map((row) => (
                  <SubjectAttendance
                    key={row.offeringId ?? "class"}
                    row={row}
                  />
                ))}
              </ul>
            )}
          </DashPanel>

          <DashPanel
            title="Marks snapshot"
            description={
              latest == null ? "Your latest semester" : `Semester ${latest}`
            }
            href={MARKS_HREF}
            hrefLabel="Open my marks"
            className="lg:col-span-5"
          >
            {snapshot.length === 0 ? (
              <EmptyState
                icon={GraduationCapIcon}
                title="No marks yet"
                description="Your results appear here once your teachers enter them and the class coordinator publishes them."
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground [&>th]:pb-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:whitespace-nowrap">
                        <th className="w-24">Code</th>
                        <th>Subject</th>
                        <th className="w-24 text-right">Total</th>
                        <th className="w-28 text-right">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {snapshot.map((row) => (
                        <SnapshotRow key={row.code} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t pt-3">
                  <Completion
                    done={snapshotGraded}
                    total={snapshot.length}
                    noun="subjects graded"
                  />
                </div>
              </div>
            )}
          </DashPanel>

          <DashPanel
            title="Waiting on"
            description="Marks appear once the class coordinator publishes them."
            href={MARKS_HREF}
            hrefLabel="Open my marks"
            className="lg:col-span-5"
          >
            {awaiting.length === 0 ? (
              <EmptyState
                icon={CircleCheckIcon}
                title="Everything published"
                description="Every subject on your record has published results."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {awaiting.map((a) => (
                  <li
                    key={`${a.semester}-${a.code}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="min-w-0 truncate text-sm">
                      <span className="identifier text-muted-foreground">
                        {a.code}
                      </span>{" "}
                      {a.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                      Semester {a.semester}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashPanel>
        </DashGrid>
      </div>
    </>
  )
}

function SubjectAttendance({ row }: { row: AttendanceRow }) {
  const short = row.percent != null && row.percent < THRESHOLD
  const width = row.percent == null ? 0 : Math.min(row.percent, 100)

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm">
          <span className="identifier text-muted-foreground">{row.code}</span>{" "}
          {row.name}
        </span>
        <span className="identifier shrink-0 whitespace-nowrap">
          <span className={cn(short && "text-attention")}>
            {row.percent == null ? "—" : `${row.percent}%`}
          </span>
          <span className="text-muted-foreground">
            {" "}
            {row.present}/{row.total}
          </span>
        </span>
      </div>
      <div className="relative" aria-hidden>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-blue h-full rounded-full"
            style={{ width: `${width}%` }}
          />
        </div>
        <div className="bg-foreground/30 absolute -top-0.5 -bottom-0.5 left-[75%] w-px" />
      </div>
      {short && (
        <Badge variant="outline" className="text-attention w-fit">
          Short
        </Badge>
      )}
    </li>
  )
}

function SnapshotRow({ row }: { row: Snapshot }) {
  return (
    <tr className="[&>td]:py-2 [&>td]:align-top">
      <td className="identifier whitespace-nowrap">{row.code}</td>
      <td className="max-w-[14rem] pr-3">{row.name}</td>
      <td className="text-right">
        {!row.published || row.state === "empty" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            <span className="identifier">
              {row.total}
              <span className="text-muted-foreground">/{row.maxTotal}</span>
            </span>
            {row.state === "partial" && (
              <span className="text-muted-foreground block text-xs">
                provisional
              </span>
            )}
          </>
        )}
      </td>
      <td className="text-right">
        {!row.published ? (
          <Badge
            variant="outline"
            className="text-muted-foreground font-normal"
          >
            Awaiting
          </Badge>
        ) : row.state === "graded" ? (
          row.gradePoint === "Fail" ? (
            <Badge variant="destructive">Fail</Badge>
          ) : (
            <Badge variant="outline">{row.gradePoint}</Badge>
          )
        ) : row.state === "partial" ? (
          <span className="text-muted-foreground text-xs">In progress</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}
