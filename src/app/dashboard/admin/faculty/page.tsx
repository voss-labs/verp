import { PageHeader } from "@/components/page-header"
import { getAllFaculty } from "@/db/queries/faculty"
import { listDepartments } from "@/db/queries/departments"
import { listActiveAppointments } from "@/db/queries/appointments"
import { FacultyAdminClient } from "./client"

export const dynamic = "force-dynamic"

export default async function AdminFacultyPage() {
  const [faculty, departments, appointments] = await Promise.all([
    getAllFaculty(),
    listDepartments(),
    listActiveAppointments(),
  ])

  return (
    <>
      <PageHeader
        title="Faculty"
        parent="Administration"
        parentHref="/dashboard/admin"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <FacultyAdminClient
          faculty={faculty.map((f) => ({
            id: f.id,
            name: `${f.firstName} ${f.lastName}`.trim(),
            email: f.email,
            employeeId: f.employeeId,
            department: f.department,
            role: f.role,
          }))}
          departments={departments
            .filter((d) => d.isActive)
            .map((d) => ({ code: d.code, name: d.name }))}
          appointments={appointments}
        />
      </div>
    </>
  )
}
