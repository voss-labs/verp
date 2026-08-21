import { Building2Icon, LayersIcon, LibraryIcon } from "lucide-react"

import { TrendLine } from "@/components/dash-chart"
import { DashGrid, DashPanel } from "@/components/dash-panel"
import { DeniedToast } from "@/components/denied-toast"
import { EmptyState } from "@/components/empty-state"
import { MarksSplitBar } from "@/components/marks-split-bar"
import { PageHeader } from "@/components/page-header"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { buildAttention } from "@/lib/attention"
import { can } from "@/lib/rbac"
import { expectedYear, type Year } from "@/lib/roll-number"
import type { SessionUser } from "@/lib/session"
import { listClassStaff } from "@/db/queries/class-staff"
import { listClassesForDepts } from "@/db/queries/classes"
import {
  attendanceTrendByScope,
  getClassWork,
  getDeptHealth,
  marksCompletionByDept,
  registersTodayByClass,
  registersTodayByDept,
} from "@/db/queries/overview"
import { AttentionInbox } from "./attention-inbox"
import { HodClassesTable, type HodClassRow } from "./hod-classes"

const YEARS: Year[] = ["FE", "SE", "TE", "BE"]
const TREND_DAYS = 14

const DAY_LABEL = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata",
})

export async function HodDashboard({
  user,
  today,
  denied,
}: {
  user: SessionUser
  today: string
  denied?: string
}) {
  const deptCodes = user.deptCodes
  const [health, allClasses] = await Promise.all([
    getDeptHealth(deptCodes),
    listClassesForDepts(deptCodes),
  ])

  const active = allClasses.filter((c) => c.isActive)
  const classIds = active.map((c) => c.id)

  const [work, staff, registers, deptRegisters, deptMarks, trendPoints] =
    await Promise.all([
      getClassWork(classIds, null, today),
      listClassStaff(classIds),
      registersTodayByClass(classIds, today),
      registersTodayByDept(deptCodes, today),
      marksCompletionByDept(deptCodes),
      attendanceTrendByScope({ deptCodes }, TREND_DAYS),
    ])

  const attention = buildAttention({
    classWork: work,
    deptHealth: health,
    today,
  }).filter((item) => item.kind !== "marks")

  const workById = new Map(work.map((w) => [w.classId, w]))
  const registerById = new Map(registers.map((r) => [r.classId, r]))
  const coordinatorById = new Map(
    staff
      .filter((s) => s.role === "academic_coordinator")
      .map((s) => [s.classId, `${s.firstName} ${s.lastName}`.trim()])
  )

  const now = new Date()
  const rows: HodClassRow[] = active.map((c) => {
    const w = workById.get(c.id)
    const subjects = w?.mySubjects ?? []
    return {
      id: c.id,
      classKey: c.classKey,
      deptCode: c.departmentCode,
      year: expectedYear(c.admissionYear, now),
      division: c.division,
      coordinator: coordinatorById.get(c.id) ?? null,
      roster: registerById.get(c.id)?.roster ?? w?.students ?? 0,
      marked: registerById.get(c.id)?.marked ?? 0,
      subjects: subjects.length,
      unallocated: w?.unallocatedSubjects ?? 0,
      entered: subjects.reduce((n, s) => n + s.entered, 0),
      pendingRequests: w?.pendingRequests ?? 0,
    }
  })

  const totals = health.reduce(
    (acc, d) => ({
      classes: acc.classes + d.classes,
      faculty: acc.faculty + d.faculty,
      students: acc.students + d.students,
      unclaimed: acc.unclaimed + d.unclaimedStudents,
      noCoordinator: acc.noCoordinator + d.classesWithoutCoordinator,
      unallocated: acc.unallocated + d.unallocatedSubjects,
    }),
    {
      classes: 0,
      faculty: 0,
      students: 0,
      unclaimed: 0,
      noCoordinator: 0,
      unallocated: 0,
    }
  )

  const registerTotals = deptRegisters.reduce(
    (acc, d) => ({
      classes: acc.classes + d.classes,
      marked: acc.marked + d.classesMarked,
    }),
    { classes: 0, marked: 0 }
  )

  const marksTotals = deptMarks.reduce(
    (acc, d) => ({
      offerings: acc.offerings + d.offerings,
      complete: acc.complete + d.offeringsComplete,
    }),
    { offerings: 0, complete: 0 }
  )

  const allocation = YEARS.map((year) => {
    const mine = rows.filter((r) => r.year === year)
    return {
      year,
      classes: mine.length,
      total: mine.reduce((n, r) => n + r.subjects, 0),
      allocated: mine.reduce((n, r) => n + r.subjects - r.unallocated, 0),
    }
  }).filter((a) => a.classes > 0)

  const trend = trendPoints.map((p) => ({
    date: DAY_LABEL.format(new Date(`${p.dateKey}T00:00:00+05:30`)),
    value: p.marked > 0 ? Math.round((p.present / p.marked) * 100) : 0,
  }))

  const seesDept = can(user, "dept:read")
  const seesStudents = can(user, "student:read")
  const seesFaculty = can(user, "faculty:read")
  const canAssign = can(user, "assignment:create")
  const canAppoint = canAssign && can(user, "offering:create")

  const single = deptCodes.length === 1 ? deptCodes[0] : null
  const deptHref = seesDept
    ? single
      ? `/dashboard/dept/${single}`
      : "/dashboard/dept"
    : undefined
  const classesHref = seesDept ? "/dashboard/dept" : undefined
  const studentsHref = seesStudents
    ? single
      ? `/dashboard/students?department=${single}`
      : "/dashboard/students"
    : undefined
  const allocationHref = canAppoint ? "/dashboard/dept/appoint" : deptHref

  if (health.length === 0) {
    return (
      <>
        <PageHeader title="Overview" />
        {denied && <DeniedToast scope={denied} />}
        <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
          <EmptyState
            icon={Building2Icon}
            title="No department is assigned to you"
            description="Ask an administrator to appoint you to a department."
            variant="dashed"
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Overview" />
      {denied && <DeniedToast scope={denied} />}
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {user.name || user.email}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {health.map((d) => `${d.code} · ${d.name}`).join(" — ")}
          </p>
        </div>

        <DashGrid>
          <StatCardRow className="lg:col-span-12 lg:grid-cols-6">
            <StatCard
              label="Classes"
              value={totals.classes}
              detail={
                registerTotals.classes > 0
                  ? `${registerTotals.marked} of ${registerTotals.classes} registers today`
                  : "No active classes"
              }
              href={classesHref}
            />
            <StatCard
              label="Faculty"
              value={totals.faculty}
              href={seesFaculty ? "/dashboard/faculty" : undefined}
            />
            <StatCard
              label="Students"
              value={totals.students}
              href={studentsHref}
            />
            <StatCard
              label="Unclaimed students"
              value={totals.unclaimed}
              tone={totals.unclaimed > 0 ? "attention" : "default"}
              detail="Never signed in"
              href={studentsHref}
            />
            <StatCard
              label="Classes without a coordinator"
              value={totals.noCoordinator}
              tone={totals.noCoordinator > 0 ? "destructive" : "default"}
              href={classesHref}
            />
            <StatCard
              label="Unallocated subjects"
              value={totals.unallocated}
              tone={totals.unallocated > 0 ? "attention" : "default"}
              detail="No teacher yet"
              href={classesHref}
            />
          </StatCardRow>

          <DashPanel
            className="lg:col-span-12"
            title="Classes"
            description={
              marksTotals.offerings > 0
                ? `${marksTotals.complete} of ${marksTotals.offerings} subjects fully entered`
                : "No subjects offered yet"
            }
            href={classesHref}
            hrefLabel="Manage"
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={LayersIcon}
                title="No active classes"
                description="Create a class from the department console to start allocating subjects."
                variant="dashed"
              />
            ) : (
              <HodClassesTable
                rows={rows}
                showDept={!single}
                canAssign={canAssign}
              />
            )}
          </DashPanel>

          <DashPanel
            className="lg:col-span-6"
            title="Attendance"
            description={`Percent present, last ${TREND_DAYS} recorded days`}
            href={deptHref}
            hrefLabel="Department"
          >
            <TrendLine
              data={trend}
              yLabel="Percent present"
              emptyLabel="No attendance recorded yet"
            />
          </DashPanel>

          <DashPanel
            className="lg:col-span-6"
            title="Subject allocation"
            description="Subjects with a teacher, by year"
            href={allocationHref}
            hrefLabel="Allocate"
          >
            {allocation.every((a) => a.total === 0) ? (
              <EmptyState
                icon={LibraryIcon}
                title="No subjects offered yet"
                description="Offer a course on a class before it can be allocated to a teacher."
                variant="dashed"
              />
            ) : (
              <div className="flex flex-col gap-3">
                {allocation.map((a) => {
                  const open = a.total - a.allocated
                  return (
                    <div key={a.year} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-medium">{a.year}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {a.allocated} of {a.total} allocated
                          {open > 0 && (
                            <span className="text-attention">
                              {" "}
                              · {open} open
                            </span>
                          )}
                        </span>
                      </div>
                      <MarksSplitBar
                        compact
                        segments={[{ label: "Allocated", value: a.allocated }]}
                        total={a.total}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </DashPanel>

          <div className="lg:col-span-12">
            <AttentionInbox items={attention} />
          </div>
        </DashGrid>
      </div>
    </>
  )
}
