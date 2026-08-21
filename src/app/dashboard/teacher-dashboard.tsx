import { GraduationCapIcon } from "lucide-react"

import { TrendLine } from "@/components/dash-chart"
import { DashGrid, DashPanel } from "@/components/dash-panel"
import { DeniedToast } from "@/components/denied-toast"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { buildAttention, groupAttention } from "@/lib/attention"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import type { SessionUser } from "@/lib/session"
import {
  attendanceTrendByScope,
  getClassWork,
  marksCompletionByOffering,
  pendingEnrolmentsForClasses,
  registersTodayByClass,
  type ClassWork,
} from "@/db/queries/overview"
import {
  AttentionFeed,
  ClassSubjectsTable,
  EnrolmentQueue,
  MySubjectsTable,
  TodayQueue,
  capacityOf,
  enteredOf,
  type MySubject,
  type QueuedEnrolment,
  type TodayClass,
} from "./teacher-panels"

const QUEUE_PREVIEW = 5

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
  const [work, registers, offerings, trend, pending] = await Promise.all([
    getClassWork(user.classIds, user.facultyId, today),
    registersTodayByClass(user.classIds, today),
    marksCompletionByOffering(user.classIds),
    attendanceTrendByScope({ classIds: user.classIds }, 7),
    pendingEnrolmentsForClasses(user.coordinatorClassIds, QUEUE_PREVIEW),
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

  const withKey = (classId: string) => classOf.get(classId)?.classKey ?? null

  const mine = offerings.flatMap<MySubject>((o) => {
    const classKey = withKey(o.classId)
    if (classKey === null) return []
    if (o.facultyId == null || o.facultyId !== user.facultyId) return []
    return [{ ...o, classKey }]
  })

  const coordinated = work.filter((c) =>
    user.coordinatorClassIds.includes(c.classId)
  )
  const isCoordinator = coordinated.length > 0
  const teaches = mine.length > 0
  const showTeaching = !isCoordinator || teaches

  const canAttendance = can(user, "attendance:write")
  const canMarks = can(user, "marks:write")
  const canApprove = can(user, "onboarding:approve")

  const scope = isCoordinator && !teaches ? coordinated : work
  const scopeIds = new Set(scope.map((c) => c.classId))
  const scoped = registers.filter((r) => scopeIds.has(r.classId))

  const rosterTotal = scoped.reduce((n, r) => n + r.roster, 0)
  const markedTotal = scoped.reduce((n, r) => n + r.marked, 0)
  const takenCount = scoped.filter(
    (r) => r.roster > 0 && r.marked >= r.roster
  ).length
  const allTaken = scoped.length > 0 && takenCount === scoped.length
  const nextRegister = scoped.find((r) => r.marked < r.roster) ?? scoped.at(0)

  const enteredTotal = mine.reduce((n, o) => n + enteredOf(o), 0)
  const capacityTotal = mine.reduce((n, o) => n + capacityOf(o), 0)
  const marksPct =
    capacityTotal > 0 ? Math.round((enteredTotal / capacityTotal) * 100) : 0
  const publishedCount = mine.filter((o) => o.publishedAt !== null).length

  const classSubjects = offerings
    .flatMap<MySubject>((o) => {
      const classKey = withKey(o.classId)
      if (classKey === null) return []
      if (!user.coordinatorClassIds.includes(o.classId)) return []
      return [{ ...o, classKey }]
    })
    .sort(
      (a, b) =>
        Number(a.facultyId !== null) - Number(b.facultyId !== null) ||
        a.courseCode.localeCompare(b.courseCode)
    )
  const classPublished = classSubjects.filter(
    (o) => o.publishedAt !== null
  ).length

  const queue: QueuedEnrolment[] = pending.flatMap((r) => {
    const classKey = withKey(r.classId)
    if (classKey === null) return []
    return [{ ...r, classKey }]
  })
  const pendingTotal = coordinated.reduce((n, c) => n + c.pendingRequests, 0)
  const queueClass =
    coordinated.find((c) => c.pendingRequests > 0) ?? coordinated.at(0)
  const queueHome = queueClass
    ? `/dashboard/class/${queueClass.classId}`
    : "/dashboard/class"

  const oneCoordinated = coordinated.length === 1 ? coordinated[0] : null
  const classHome = oneCoordinated
    ? `/dashboard/class/${oneCoordinated.classId}`
    : "/dashboard/class"
  const subjectsHome =
    oneCoordinated && can(user, "offering:read")
      ? `/dashboard/class/${oneCoordinated.classId}/subjects`
      : classHome

  const only = work.length === 1 ? work[0] : null
  const marksHome =
    canMarks && only ? `/dashboard/class/${only.classId}/marks` : ""
  const registerHome =
    canAttendance && only ? `/dashboard/class/${only.classId}/attendance` : ""

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

  const attention = groupAttention(
    buildAttention({ classWork: work, deptHealth: [], today })
  )

  const trendData = trend.map((p) => ({
    date: DAY.format(atIst(p.dateKey)),
    value: p.marked > 0 ? Math.round((p.present / p.marked) * 100) : 0,
  }))

  const registerCard = (
    <StatCard
      label="Register today"
      value={allTaken ? "Taken" : "Not taken"}
      tone={allTaken ? "success" : "attention"}
      detail={
        scoped.length > 1
          ? `${takenCount} of ${scoped.length} classes · ${markedTotal} of ${rosterTotal} marked`
          : `${markedTotal} of ${rosterTotal} marked`
      }
      href={
        canAttendance && nextRegister
          ? `/dashboard/class/${nextRegister.classId}/attendance`
          : undefined
      }
    />
  )

  const pendingCard = (
    <StatCard
      label="Pending enrolments"
      value={pendingTotal}
      tone={pendingTotal > 0 ? "attention" : "default"}
      detail={`${coordinated.length} coordinated`}
      href={queueClass ? queueHome : undefined}
    />
  )

  return (
    <>
      <PageHeader title="Overview" />
      {denied && <DeniedToast scope={denied} />}
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <Intro
          name={name}
          line={
            showTeaching
              ? `Your teaching work for ${LONG_DAY.format(atIst(today))}.`
              : `Your class coordination for ${LONG_DAY.format(atIst(today))}.`
          }
        />

        {showTeaching ? (
          <StatCardRow className={isCoordinator ? "lg:grid-cols-5" : undefined}>
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
            {registerCard}
            <StatCard
              label="Marks entered"
              value={`${marksPct}%`}
              tone={
                capacityTotal > 0 && marksPct === 100 ? "success" : "default"
              }
              detail={`${enteredTotal} of ${capacityTotal} entries`}
              href={marksHome || "/dashboard/class"}
            />
            {isCoordinator && pendingCard}
          </StatCardRow>
        ) : (
          <StatCardRow className="lg:grid-cols-5">
            <StatCard
              label="My class"
              value={
                oneCoordinated ? (
                  <span className="identifier">{oneCoordinated.classKey}</span>
                ) : (
                  coordinated.length
                )
              }
              detail={
                oneCoordinated
                  ? label(oneCoordinated)
                  : `${coordinated.length} coordinated`
              }
              href={classHome}
            />
            <StatCard
              label="Roster"
              value={rosterTotal}
              detail={
                oneCoordinated
                  ? "students in the class"
                  : `across ${coordinated.length} classes`
              }
              href={classHome}
            />
            {registerCard}
            {pendingCard}
            <StatCard
              label="Published subjects"
              value={classPublished}
              tone={
                classSubjects.length > 0 &&
                classPublished === classSubjects.length
                  ? "success"
                  : "default"
              }
              detail={`of ${classSubjects.length} allocated on the class`}
              href={subjectsHome}
            />
          </StatCardRow>
        )}

        <DashGrid>
          {isCoordinator && (
            <>
              <DashPanel
                title="Enrolment queue"
                description="Students waiting on your decision before they can see anything."
                href={queueHome}
                hrefLabel="Class overview"
                className="lg:col-span-7"
              >
                <EnrolmentQueue
                  requests={queue}
                  remaining={Math.max(0, pendingTotal - queue.length)}
                  showClass={coordinated.length > 1}
                  canApprove={canApprove}
                />
              </DashPanel>

              <DashPanel
                title="Class subjects"
                description="Who teaches what, and how far its marks have got."
                href={subjectsHome}
                hrefLabel="Subjects"
                className="lg:col-span-5"
              >
                <ClassSubjectsTable
                  subjects={classSubjects}
                  canMarks={canMarks}
                  showClass={coordinated.length > 1}
                  subjectsHref={subjectsHome}
                />
              </DashPanel>
            </>
          )}

          {showTeaching && (
            <>
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
            </>
          )}

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
            <AttentionFeed groups={attention} />
          </DashPanel>
        </DashGrid>
      </div>
    </>
  )
}
