import { PageHeader } from "@/components/page-header"
import { getAllFaculty } from "@/db/queries/faculty"
import { listDepartments } from "@/db/queries/departments"
import { listActiveAppointments } from "@/db/queries/appointments"
import { AppointmentsClient } from "./client"

export const dynamic = "force-dynamic"

export default async function AdminAppointmentsPage() {
  const [faculty, departments, appointments] = await Promise.all([
    getAllFaculty(),
    listDepartments(),
    listActiveAppointments(),
  ])

  return (
    <>
      <PageHeader
        title="Appointments"
        parent="Administration"
        parentHref="/dashboard/admin"
        description="Appoint the HOD and coordinator for each department. HOD promotes the faculty's tier automatically."
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <AppointmentsClient
          departments={departments
            .filter((d) => d.isActive)
            .map((d) => ({ code: d.code, name: d.name }))}
          faculty={faculty
            .filter((f) => f.role !== "super_admin")
            .map((f) => ({
              id: f.id,
              name: `${f.firstName} ${f.lastName}`.trim(),
            }))}
          appointments={appointments}
        />
      </div>
    </>
  )
}
