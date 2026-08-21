import { PageHeader } from "@/components/page-header"
import { listDepartments } from "@/db/queries/departments"
import { listActiveAppointments } from "@/db/queries/appointments"
import { getAllFaculty } from "@/db/queries/faculty"
import { DepartmentsClient } from "./client"

export const dynamic = "force-dynamic"

export default async function DepartmentsPage() {
  const [departments, appointments, faculty] = await Promise.all([
    listDepartments(),
    listActiveAppointments(),
    getAllFaculty(),
  ])

  const hodByDept = new Map(
    appointments
      .filter((a) => a.appointment === "hod")
      .map((a) => [
        a.deptCode,
        { id: a.facultyId, name: `${a.firstName} ${a.lastName}`.trim() },
      ])
  )

  return (
    <>
      <PageHeader
        title="Departments"
        parent="Administration"
        parentHref="/dashboard/admin"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <DepartmentsClient
          departments={departments.map((d) => ({
            code: d.code,
            name: d.name,
            isActive: d.isActive,
            hod: hodByDept.get(d.code) ?? null,
          }))}
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
