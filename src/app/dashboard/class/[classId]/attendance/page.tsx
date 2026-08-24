import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ClassTabs } from "../class-tabs"
import { classTabs, classTrail } from "../class-context"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { getStudentsByClassKeys } from "@/db/queries/students"
import { listOfferingsForClass } from "@/db/queries/offerings"
import {
  getStudentsInBatch,
  listBatchesForOffering,
} from "@/db/queries/batches"
import { getAttendanceForSession } from "@/db/queries/attendance"
import { canWriteOffering } from "@/lib/allocation"
import { AttendanceClient } from "./client"

type Status = "present" | "absent" | "late" | "excused"
type RosterRow = {
  id: string
  firstName: string
  lastName: string
  rollNumber: string
}
type MarkRow = { studentId: string; status: Status }

export const dynamic = "force-dynamic"

const SESSION_DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
})

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>
  searchParams: Promise<{
    date?: string
    slot?: string
    offering?: string
    batch?: string
  }>
}) {
  const { classId } = await params
  const sp = await searchParams
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "attendance:write")) redirect("/dashboard")

  const cls = await getClassById(classId)
  if (!cls) return notFound()
  const canAllocate =
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode)) ||
    user.coordinatorClassIds.includes(classId)
  const inScope =
    user.tier === "super_admin" ||
    user.classIds.includes(classId) ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode))
  if (!inScope) redirect("/dashboard/class?denied=class")

  // The college's date, not UTC. toISOString() rolls over at 05:30 IST and
  // would open tomorrow's register during an early-morning lecture.
  const date =
    sp.date ||
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
      new Date()
    )
  const slot = sp.slot || "1"
  const offeringId = sp.offering || null

  const [classRoster, allOfferings, offeringBatches] = await Promise.all([
    getStudentsByClassKeys([cls.classKey]),
    listOfferingsForClass(classId),
    offeringId ? listBatchesForOffering(offeringId) : Promise.resolve([]),
  ])

  // Offering every subject to every teacher on the class invited them to take a
  // register they are not allowed to save — the action refuses it, so the only
  // thing the extra options produced was a dead end. Coordinators, HODs and
  // admins keep the full list: covering an absent colleague is their job.
  const offerings = allOfferings.filter((o) =>
    canWriteOffering(user, o.facultyId, classId, cls.departmentCode)
  )

  const selected = offeringId
    ? offerings.find((o) => o.id === offeringId)
    : undefined
  const practical = !!selected && selected.course.courseType !== "theory"
  const batches = practical
    ? offeringBatches.map((b) => ({
        id: b.id,
        name: b.name,
        count: b.assignments.filter((a) => a.student.isActive).length,
      }))
    : []
  const batchId = batches.some((b) => b.id === sp.batch) ? sp.batch! : null

  const needsBatch = batches.length > 0 && !batchId
  const batchName = batches.find((b) => b.id === batchId)?.name ?? null
  const batchesHref =
    practical && selected && can(user, "marks:write")
      ? `/dashboard/class/${classId}/batches?offering=${selected.id}`
      : null

  const rosterQuery: Promise<RosterRow[]> = batchId
    ? getStudentsInBatch(batchId)
    : Promise.resolve(needsBatch ? [] : classRoster)
  const marksQuery: Promise<MarkRow[]> = needsBatch
    ? Promise.resolve([])
    : getAttendanceForSession(classId, date, slot, offeringId, batchId)
  const [roster, existing] = await Promise.all([rosterQuery, marksQuery])

  const marked: Record<string, string> = {}
  for (const e of existing) marked[e.studentId] = e.status

  const yr = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  const label = `${yr} · ${cls.departmentCode} · ${cls.division}`
  const subject = selected
    ? `${selected.course.courseCode} ${selected.course.courseName}`
    : "Class session, no subject"
  const announcement = needsBatch
    ? `${subject}. No batch selected, so no register is open.`
    : `${subject}${batchName ? `, batch ${batchName}` : ""}. ${roster.length} student${roster.length === 1 ? "" : "s"} in this register.`

  return (
    <>
      <PageHeader
        title={`Attendance — ${label}`}
        trail={classTrail(cls, label)}
        parent="My classes"
        parentHref={`/dashboard/class/${classId}`}
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ClassTabs tabs={classTabs(classId, user, { canAllocate })} />
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <AttendanceClient
          key={`${date}|${slot}|${offeringId ?? ""}|${batchId ?? ""}`}
          classId={classId}
          date={date}
          dateLabel={SESSION_DAY.format(new Date(`${date}T00:00:00+05:30`))}
          slot={slot}
          offeringId={offeringId}
          batchId={batchId}
          practical={practical}
          needsBatch={needsBatch}
          batchesHref={batchesHref}
          offerings={offerings.map((o) => ({
            id: o.id,
            code: o.course.courseCode,
            name: o.course.courseName,
          }))}
          batches={batches}
          students={roster.map((s) => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`.trim(),
            rollNumber: s.rollNumber,
            // Unmarked, never present. Defaulting to present meant opening a
            // fresh session and pressing Save recorded the whole class as
            // attending — a register nobody took, indistinguishable from one
            // they did.
            status: (marked[s.id] as Status | undefined) ?? null,
          }))}
        />
      </div>
    </>
  )
}
