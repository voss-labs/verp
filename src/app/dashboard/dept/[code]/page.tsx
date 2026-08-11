import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { expectedYear, currentYear } from "@/lib/roll-number"
import { getDepartment } from "@/db/queries/departments"
import { listClassesForDepts } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { listActiveAppointments } from "@/db/queries/appointments"
import { getFacultyByDepartments } from "@/db/queries/faculty"
import {
  getStudentsByDepartments,
  getGraduatedClassKeys,
} from "@/db/queries/students"
import { DeptDashboardClient } from "./client"

export const dynamic = "force-dynamic"

export default async function DepartmentDashboard({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  // Department codes are stored uppercase; a link or a typed URL may not be.
  const deptCode = decodeURIComponent(code).toUpperCase()

  const user = await getSessionUser()
  if (!user) redirect("/login")

  // super_admin sees any department; an HOD only their own. Without this an HOD
  // could read a peer department's whole roster by editing the URL — the nav
  // never offers it, which is exactly why the check cannot live in the nav.
  const allowed =
    user.tier === "super_admin" || user.deptCodes.includes(deptCode)
  if (!allowed) redirect("/dashboard/dept")

  const dept = await getDepartment(deptCode)
  if (!dept) return notFound()

  const [classes, faculty, students, appointments, graduated] =
    await Promise.all([
      listClassesForDepts([deptCode]),
      getFacultyByDepartments([deptCode]),
      getStudentsByDepartments([deptCode]),
      listActiveAppointments(),
      getGraduatedClassKeys(),
    ])
  const staff = await listClassStaff(classes.map((c) => c.id))
  const now = new Date()

  const mine = appointments.filter((a) => a.deptCode === deptCode)
  const named = (a: (typeof mine)[number]) =>
    `${a.firstName} ${a.lastName}`.trim()

  // Class membership is derived from class_key, and that key is stored rather
  // than foreign-keyed — a cohort can have students before anybody creates its
  // class row. Bucketing by class alone would silently drop them, so the
  // leftovers are counted explicitly and surfaced.
  const byKey = new Map<string, typeof students>()
  for (const s of students) {
    const key = s.classKey ?? ""
    const list = byKey.get(key) ?? []
    list.push(s)
    byKey.set(key, list)
  }
  const knownKeys = new Set(classes.map((c) => c.classKey))
  const unplaced = students.filter(
    (s) => !s.classKey || !knownKeys.has(s.classKey)
  )

  const classRows = classes.map((c) => {
    const roster = byKey.get(c.classKey) ?? []
    const mineStaff = staff.filter((s) => s.classId === c.id)
    const coord = mineStaff.find((s) => s.role === "academic_coordinator")
    const trs = mineStaff.filter((s) => s.role === "tr")
    return {
      id: c.id,
      classKey: c.classKey,
      label: `${expectedYear(c.admissionYear, now) ?? c.admissionYear} · ${c.division}`,
      isActive: c.isActive,
      graduated: graduated.has(c.classKey),
      coordinator: coord ? `${coord.firstName} ${coord.lastName}`.trim() : null,
      trs: trs.map((t) => `${t.firstName} ${t.lastName}`.trim()),
      students: roster.length,
      unclaimed: roster.filter((s) => !s.authUserId).length,
    }
  })

  // A faculty member's class roles, so the table shows what they actually do
  // rather than only their tier.
  const rolesFor = (facultyId: string) => {
    const held = staff.filter((s) => s.facultyId === facultyId)
    const out: string[] = []
    if (held.some((h) => h.role === "academic_coordinator")) out.push("AC")
    if (held.some((h) => h.role === "tr")) out.push("TR")
    return out
  }

  return (
    <>
      <PageHeader
        title={`${dept.code} — ${dept.name}`}
        parent="Departments"
        parentHref="/dashboard/dept"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <DeptDashboardClient
          dept={{ code: dept.code, name: dept.name, isActive: dept.isActive }}
          hod={
            mine.find((a) => a.appointment === "hod")
              ? {
                  name: named(mine.find((a) => a.appointment === "hod")!),
                  email: mine.find((a) => a.appointment === "hod")!.email,
                }
              : null
          }
          coordinator={
            mine.find((a) => a.appointment === "coordinator")
              ? {
                  name: named(
                    mine.find((a) => a.appointment === "coordinator")!
                  ),
                  email: mine.find((a) => a.appointment === "coordinator")!
                    .email,
                }
              : null
          }
          classes={classRows}
          faculty={faculty.map((f) => ({
            id: f.id,
            name: `${f.firstName} ${f.lastName}`.trim(),
            email: f.email,
            tier: f.role,
            classRoles: rolesFor(f.id),
            claimed: Boolean(f.authUserId),
          }))}
          totals={{
            students: students.length,
            unclaimedStudents: students.filter((s) => !s.authUserId).length,
            unplaced: unplaced.length,
          }}
          unplaced={unplaced.slice(0, 200).map((s) => ({
            id: s.id,
            rollNumber: s.rollNumber,
            name: `${s.firstName} ${s.lastName}`.trim(),
            classKey: s.classKey,
            year: currentYear(s.rollNumber, s.year, now, s.graduatedAt),
          }))}
        />
      </div>
    </>
  )
}
