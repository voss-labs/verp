import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ClassTabs } from "../class-tabs"
import { classTabs, classTrail } from "../class-context"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { getStudentsByClassKeys } from "@/db/queries/students"
import { getAttendanceForSession } from "@/db/queries/attendance"
import { AttendanceClient } from "./client"

type Status = "present" | "absent" | "late" | "excused"

export const dynamic = "force-dynamic"

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>
  searchParams: Promise<{ date?: string; slot?: string }>
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
  if (!inScope) redirect("/dashboard/class")

  const date = sp.date || new Date().toISOString().slice(0, 10)
  const slot = sp.slot || "1"

  const [students, existing] = await Promise.all([
    getStudentsByClassKeys([cls.classKey]),
    getAttendanceForSession(classId, date, slot),
  ])
  const marked: Record<string, string> = {}
  for (const e of existing) marked[e.studentId] = e.status

  const yr = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  const label = `${yr} · ${cls.departmentCode} · ${cls.division}`

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
        <AttendanceClient
          classId={classId}
          date={date}
          slot={slot}
          students={students.map((s) => ({
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
