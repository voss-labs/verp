import { PageHeader } from "@/components/page-header"
import { listDepartments } from "@/db/queries/departments"
import { listActiveAppointments } from "@/db/queries/appointments"
import { getAllFaculty } from "@/db/queries/faculty"
import { getDeptHealth } from "@/db/queries/overview"
import { DepartmentsClient } from "./client"

export const dynamic = "force-dynamic"

export default async function DepartmentsPage() {
  const [departments, appointments, faculty] = await Promise.all([
    listDepartments(),
    listActiveAppointments(),
    getAllFaculty(),
  ])
  const health = await getDeptHealth(departments.map((d) => d.code))

  const hodByDept = new Map(
    appointments
      .filter((a) => a.appointment === "hod")
      .map((a) => [
        a.deptCode,
        { id: a.facultyId, name: `${a.firstName} ${a.lastName}`.trim() },
      ])
  )

  const coordinatorsByDept = new Map<string, string[]>()
  for (const a of appointments) {
    if (a.appointment !== "coordinator") continue
    const named = coordinatorsByDept.get(a.deptCode) ?? []
    named.push(`${a.firstName} ${a.lastName}`.trim())
    coordinatorsByDept.set(a.deptCode, named)
  }

  const healthByDept = new Map(health.map((h) => [h.code, h]))

  return (
    <>
      <PageHeader
        title="Departments"
        parent="Administration"
        parentHref="/dashboard/admin"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <DepartmentsClient
          departments={departments.map((d) => {
            const h = healthByDept.get(d.code)
            return {
              code: d.code,
              name: d.name,
              isActive: d.isActive,
              hod: hodByDept.get(d.code) ?? null,
              coordinators: coordinatorsByDept.get(d.code) ?? [],
              students: h?.students ?? 0,
              faculty: h?.faculty ?? 0,
              classes: h?.classes ?? 0,
              classesWithoutCoordinator: h?.classesWithoutCoordinator ?? 0,
              unallocatedSubjects: h?.unallocatedSubjects ?? 0,
            }
          })}
          faculty={faculty
            .filter((f) => f.role !== "super_admin")
            .map((f) => ({
              id: f.id,
              name: `${f.firstName} ${f.lastName}`.trim(),
              employeeId: f.employeeId,
              department: f.department,
            }))}
        />
      </div>
    </>
  )
}
