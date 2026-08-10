import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { expectedYear } from "@/lib/roll-number"
import { listDepartments } from "@/db/queries/departments"
import { listClassesForDepts } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { getGraduatedClassKeys } from "@/db/queries/students"
import { getAllFaculty } from "@/db/queries/faculty"
import { DeptClient } from "./client"

export const dynamic = "force-dynamic"

export default async function DeptPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const allDepts = await listDepartments()
  const scope =
    user.tier === "super_admin"
      ? allDepts.filter((d) => d.isActive).map((d) => d.code)
      : user.deptCodes
  const depts = allDepts.filter((d) => scope.includes(d.code))

  const [classes, faculty] = await Promise.all([
    listClassesForDepts(scope),
    getAllFaculty(),
  ])
  const staff = await listClassStaff(classes.map((c) => c.id))
  const graduated = await getGraduatedClassKeys()
  const now = new Date()

  return (
    <>
      <PageHeader title="My department" />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <DeptClient
          departments={depts.map((d) => ({ code: d.code, name: d.name }))}
          classes={classes.map((c) => {
            const yr = expectedYear(c.admissionYear, now)
            return {
              id: c.id,
              classKey: c.classKey,
              label: `${yr ?? c.admissionYear} · ${c.departmentCode} · ${c.division}`,
              departmentCode: c.departmentCode,
              admissionYear: c.admissionYear,
              division: c.division,
              isActive: c.isActive,
              graduated: graduated.has(c.classKey),
            }
          })}
          staff={staff}
          faculty={faculty.map((f) => ({
            id: f.id,
            name: `${f.firstName} ${f.lastName}`.trim(),
            department: f.department,
            role: f.role,
          }))}
        />
      </div>
    </>
  )
}
