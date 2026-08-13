import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { expectedYear } from "@/lib/roll-number"
import { computeMarks, computeSgpi } from "@/lib/sgpi"
import { getAttendanceSummaryForStudent } from "@/db/queries/attendance"
import { getMarksForStudent } from "@/db/queries/marks"
import { getClassWork, getDeptHealth } from "@/db/queries/overview"
import { listDepartments } from "@/db/queries/departments"
import { buildAttention } from "@/lib/attention"
import { AttentionInbox } from "./attention-inbox"
import {
  Attention,
  Completion,
  EmptyHint,
  Stat,
  WorkCard,
} from "./overview-cards"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const now = new Date()
  // The college's date, not UTC: toISOString() rolls over at 05:30 IST and
  // would open tomorrow's register during an early-morning lecture.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(now)

  if (user.tier === "student") {
    return <StudentOverview userId={user.studentId} name={user.name} />
  }

  const isAdmin = user.tier === "super_admin"
  const deptCodes = isAdmin
    ? (await listDepartments()).filter((d) => d.isActive).map((d) => d.code)
    : user.deptCodes

  // A TR sees the classes they hold; an HOD sees their department's health.
  // Neither is shown a number covering ground they cannot act on.
  const [work, health] = await Promise.all([
    getClassWork(user.classIds, user.facultyId, today),
    deptCodes.length ? getDeptHealth(deptCodes) : Promise.resolve([]),
  ])

  // Derived from what was already fetched, not a fifth query.
  const attention = buildAttention({
    classWork: work,
    deptHealth: health,
    today,
  })

  const label = (c: {
    admissionYear: number
    departmentCode: string
    division: string
  }) =>
    `${expectedYear(c.admissionYear, now) ?? c.admissionYear} · ${c.departmentCode} · ${c.division}`

  return (
    <>
      <PageHeader title="Overview" />
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {user.name || user.email}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {work.length > 0
              ? "Your teaching work for today."
              : health.length > 0
                ? "Your department's academic health."
                : "Nothing is assigned to you yet."}
          </p>
        </div>

        <AttentionInbox items={attention} />

        {health.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              {isAdmin ? "Departments" : "My department"}
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {health.map((d) => (
                <WorkCard
                  key={d.code}
                  title={`${d.code} — ${d.name}`}
                  subtitle={d.hod ? `HOD: ${d.hod}` : "No HOD appointed"}
                  href={`/dashboard/dept/${d.code}`}
                  action={{ label: "Open", href: `/dashboard/dept/${d.code}` }}
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Attention
                      count={d.classesWithoutCoordinator}
                      label="Classes without a coordinator"
                      href="/dashboard/dept"
                      tone="critical"
                    />
                    <Attention
                      count={d.unallocatedSubjects}
                      label="Subjects with no teacher"
                      href="/dashboard/dept/appoint"
                    />
                    <Attention
                      count={d.unclaimedStudents}
                      label="Students yet to sign in"
                      href="/dashboard/students"
                      tone="neutral"
                    />
                    <Attention
                      count={d.classes}
                      label="Active classes"
                      href="/dashboard/dept"
                      tone="neutral"
                    />
                  </div>
                </WorkCard>
              ))}
            </div>
          </section>
        )}

        {work.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">My classes</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {work.map((c) => (
                <WorkCard
                  key={c.classId}
                  title={label(c)}
                  subtitle={
                    c.role === "academic_coordinator"
                      ? `Coordinator · ${c.classKey}`
                      : `Teacher · ${c.classKey}`
                  }
                  href={`/dashboard/class/${c.classId}`}
                  action={{
                    label: "Take attendance",
                    href: `/dashboard/class/${c.classId}/attendance`,
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <Completion
                      done={c.markedToday}
                      total={c.students}
                      noun="marked today"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Attention
                        count={c.pendingRequests}
                        label="Enrolment requests"
                        href={`/dashboard/class/${c.classId}`}
                      />
                      {c.role === "academic_coordinator" && (
                        <Attention
                          count={c.unallocatedSubjects}
                          label="Subjects with no teacher"
                          href={`/dashboard/class/${c.classId}/subjects`}
                        />
                      )}
                    </div>

                    {c.mySubjects.length === 0 ? (
                      <EmptyHint>
                        No subjects allocated to you on this class.
                      </EmptyHint>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-muted-foreground text-xs">
                          My subjects
                        </p>
                        {c.mySubjects.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="truncate">
                              <span className="font-mono text-xs">
                                {s.code}
                              </span>{" "}
                              {s.name}
                            </span>
                            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                              {s.entered} of {c.students} entered
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </WorkCard>
              ))}
            </div>
          </section>
        )}

        {work.length === 0 && health.length === 0 && (
          <EmptyHint>
            No classes are assigned to you. Ask your HOD to add you to a class.
          </EmptyHint>
        )}
      </div>
    </>
  )
}

async function StudentOverview({
  userId,
  name,
}: {
  userId: string | null
  name: string
}) {
  const att = userId ? await getAttendanceSummaryForStudent(userId) : null
  const attPct =
    att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null

  const rows = userId ? await getMarksForStudent(userId) : []
  const marks = rows.map((m) => ({
    mark: m,
    course: m.courseOffering.course,
    computed: computeMarks(m, m.courseOffering.course),
  }))
  const sgpi = computeSgpi(
    marks.map(({ mark, course }) => ({ marks: mark, course }))
  )
  // A subject with no grade yet is in progress, not zero. The old dashboard
  // showed 0/75 for the same subject My marks showed as "—".
  const graded = marks.filter((m) => m.computed.gradePoint != null).length

  return (
    <>
      <PageHeader title="Overview" />
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Your attendance and results.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Attendance"
            value={attPct === null ? "—" : `${attPct}%`}
            hint={
              att && att.total > 0
                ? `${att.present} of ${att.total} sessions present`
                : "No sessions recorded yet"
            }
          />
          <Stat
            label="SGPI"
            value={
              sgpi.sgpi === null || sgpi.hasFail ? "—" : sgpi.sgpi.toFixed(2)
            }
            hint={
              sgpi.hasFail
                ? "Held until every subject is cleared"
                : sgpi.sgpi === null
                  ? "Appears once results are complete"
                  : `${sgpi.totalCredits} credits`
            }
          />
          <Stat
            label="Subjects"
            value={String(marks.length)}
            hint={
              marks.length === 0
                ? "None yet"
                : `${graded} graded · ${marks.length - graded} in progress`
            }
          />
        </div>

        <WorkCard
          title="My marks"
          subtitle="Component breakdown for every subject"
          href="/dashboard/my-marks"
          action={{ label: "Open", href: "/dashboard/my-marks" }}
        >
          {marks.length === 0 ? (
            <EmptyHint>
              No marks recorded yet. They appear here once your teachers enter
              them.
            </EmptyHint>
          ) : (
            <Completion
              done={graded}
              total={marks.length}
              noun="subjects graded"
            />
          )}
        </WorkCard>
      </div>
    </>
  )
}
