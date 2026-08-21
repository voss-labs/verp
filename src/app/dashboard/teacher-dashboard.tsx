import { CircleCheckIcon, GraduationCapIcon } from "lucide-react"

import { AttentionGroup } from "@/components/attention-card"
import { TrendLine } from "@/components/dash-chart"
import { DashGrid, DashPanel } from "@/components/dash-panel"
import { DeniedToast } from "@/components/denied-toast"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { buildAttention, groupAttention, type Urgency } from "@/lib/attention"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import type { SessionUser } from "@/lib/session"
import {
  attendanceTrendByScope,
  getClassWork,
  marksCompletionByOffering,
  registersTodayByClass,
  type ClassWork,
} from "@/db/queries/overview"
import {
  MySubjectsTable,
  TodayQueue,
  capacityOf,
  enteredOf,
  type MySubject,
  type TodayClass,
} from "./teacher-panels"

const URGENCIES: Urgency[] = ["blocking", "overdue", "open"]

const URGENCY_HEADING: Record<Urgency, string> = {
  blocking: "Blocking",
  overdue: "Overdue",
  open: "Open",
}

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata",
})

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Asia/Kolkata",
})

const atIst = (dateKey: string) => new Date(`${dateKey}T00:00:00+05:30`)

function Intro({ name, line }: { name: string; line: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{line}</p>
    </div>
  )
}

export async function TeacherDashboard({
  user,
  today,
  denied,
}: {
  user: SessionUser
  today: string
  denied?: string
}) {
  const [work, registers, offerings, trend] = await Promise.all([
    getClassWork(user.classIds, user.facultyId, today),
    registersTodayByClass(user.classIds, today),
    marksCompletionByOffering(user.classIds),
    attendanceTrendByScope({ classIds: user.classIds }, 7),
  ])

  const name = user.name || user.email

  if (work.length === 0) {
    return (
      <>
        <PageHeader title="Overview" />
        {denied && <DeniedToast scope={denied} />}
        <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
          <Intro name={name} line="Nothing is assigned to you yet." />
          <EmptyState
            icon={GraduationCapIcon}
            title="No classes are assigned to you"
            description="Ask your HOD to add you to a class."
            variant="dashed"
          />
        </div>
      </>
    )
  }

  const now = new Date()
  const classOf = new Map(work.map((c) => [c.classId, c]))
  const registerOf = new Map(registers.map((r) => [r.classId, r]))
  const label = (c: ClassWork) =>
    `${expectedYear(c.admissionYear, now) ?? c.admissionYear} · ${c.departmentCode} · ${c.division}`

  const mine = offerings.flatMap<MySubject>((o) => {
    const c = classOf.get(o.classId)
    if (!c || o.facultyId == null || o.facultyId !== user.facultyId) return []
    return [{ ...o, classKey: c.classKey }]
  })

  const todayClasses: TodayClass[] = work.map((c) => {
    const register = registerOf.get(c.classId)
    return {
      classId: c.classId,
      classKey: c.classKey,
      label: label(c),
      coordinator: user.coordinatorClassIds.includes(c.classId),
      marked: register?.marked ?? 0,
      roster: register?.roster ?? c.students,
      subjects: mine.filter((o) => o.classId === c.classId),
    }
  })

  const canAttendance = can(user, "attendance:write")
  const canMarks = can(user, "marks:write")

  const rosterTotal = registers.reduce((n, r) => n + r.roster, 0)
  const markedTotal = registers.reduce((n, r) => n + r.marked, 0)
  const takenCount = registers.filter((r) => r.marked > 0).length
  const allTaken = registers.length > 0 && takenCount === registers.length
  const nextRegister = registers.find((r) => r.marked === 0) ?? registers.at(0)

  const enteredTotal = mine.reduce((n, o) => n + enteredOf(o), 0)
  const capacityTotal = mine.reduce((n, o) => n + capacityOf(o), 0)
  const marksPct =
    capacityTotal > 0 ? Math.round((enteredTotal / capacityTotal) * 100) : 0
  const publishedCount = mine.filter((o) => o.publishedAt !== null).length

  const coordinated = work.filter((c) =>
    user.coordinatorClassIds.includes(c.classId)
  )
  const pendingTotal = coordinated.reduce((n, c) => n + c.pendingRequests, 0)
  const queueClass =
    coordinated.find((c) => c.pendingRequests > 0) ?? coordinated.at(0)

  const only = work.length === 1 ? work[0] : null
  const marksHome =
    canMarks && only ? `/dashboard/class/${only.classId}/marks` : ""
  const registerHome =
    canAttendance && only ? `/dashboard/class/${only.classId}/attendance` : ""

  const attention = groupAttention(
    buildAttention({ classWork: work, deptHealth: [], today })
  )

  const trendData = trend.map((p) => ({
    date: DAY.format(atIst(p.dateKey)),
    value: p.marked > 0 ? Math.round((p.present / p.marked) * 100) : 0,
  }))

  return (
    <>
      <PageHeader title="Overview" />
      {denied && <DeniedToast scope={denied} />}
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <Intro
          name={name}
          line={`Your teaching work for ${LONG_DAY.format(atIst(today))}.`}
        />

        <StatCardRow
          className={coordinated.length > 0 ? "lg:grid-cols-5" : undefined}
        >
          <StatCard
            label="My classes"
            value={work.length}
            detail={`${rosterTotal} students`}
            href="/dashboard/class"
          />
          <StatCard
            label="My subjects"
            value={mine.length}
            detail={`${publishedCount} published`}
            href={marksHome || "/dashboard/class"}
          />
          <StatCard
            label="Register today"
            value={allTaken ? "Taken" : "Not taken"}
            tone={allTaken ? "success" : "attention"}
            detail={
              registers.length > 1
                ? `${takenCount} of ${registers.length} classes · ${markedTotal} of ${rosterTotal} marked`
                : `${markedTotal} of ${rosterTotal} marked`
            }
            href={
              canAttendance && nextRegister
                ? `/dashboard/class/${nextRegister.classId}/attendance`
                : undefined
            }
          />
          <StatCard
            label="Marks entered"
            value={`${marksPct}%`}
            tone={capacityTotal > 0 && marksPct === 100 ? "success" : "default"}
            detail={`${enteredTotal} of ${capacityTotal} entries`}
            href={marksHome || "/dashboard/class"}
          />
          {coordinated.length > 0 && (
            <StatCard
              label="Pending enrolments"
              value={pendingTotal}
              tone={pendingTotal > 0 ? "attention" : "default"}
              detail={`${coordinated.length} coordinated`}
              href={
                queueClass
                  ? `/dashboard/class/${queueClass.classId}`
                  : undefined
              }
            />
          )}
        </StatCardRow>

        <DashGrid>
          <DashPanel
            title="Today"
            description="Take the register, then close the gaps in your marks."
            href="/dashboard/class"
            hrefLabel="My classes"
            className="lg:col-span-7"
          >
            <TodayQueue
              classes={todayClasses}
              canAttendance={canAttendance}
              canMarks={canMarks}
            />
          </DashPanel>

          <DashPanel
            title="My subjects"
            description="Every offering allocated to you."
            href={marksHome || "/dashboard/class"}
            hrefLabel={marksHome ? "Marks" : "My classes"}
            className="lg:col-span-5"
          >
            <MySubjectsTable subjects={mine} canMarks={canMarks} />
          </DashPanel>

          <DashPanel
            title="Attendance last 7 days"
            description="Share of marked students present, days with a register only."
            href={registerHome || "/dashboard/class"}
            hrefLabel={registerHome ? "Register" : "My classes"}
            className="lg:col-span-5"
          >
            <TrendLine
              data={trendData}
              yLabel="Present %"
              emptyLabel="No register taken in the last 7 days"
            />
          </DashPanel>

          <DashPanel
            title="Needs attention"
            description="Ranked by what blocks somebody else, not by count."
            href="/dashboard/class"
            hrefLabel="My classes"
            className="lg:col-span-7"
          >
            {attention.length === 0 ? (
              <EmptyState
                icon={CircleCheckIcon}
                title="All clear"
                description="Nothing needs your attention."
                variant="dashed"
              />
            ) : (
              <div className="flex flex-col gap-4">
                {URGENCIES.map((urgency) => {
                  const items = attention.filter((g) => g.urgency === urgency)
                  if (items.length === 0) return null
                  return (
                    <AttentionGroup
                      key={urgency}
                      heading={URGENCY_HEADING[urgency]}
                      items={items.map((g) => ({
                        severity: g.urgency,
                        title: g.title,
                        description: g.detail,
                        scopes: g.scopes,
                        href: g.href,
                      }))}
                    />
                  )
                })}
              </div>
            )}
          </DashPanel>
        </DashGrid>
      </div>
    </>
  )
}
