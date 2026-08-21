import { PageHeader } from "@/components/page-header"
import { getAllFaculty } from "@/db/queries/faculty"
import { listDepartments } from "@/db/queries/departments"
import { AddFacultyDialog, FacultyAdminClient } from "./client"

export const dynamic = "force-dynamic"

export default async function AdminFacultyPage() {
  const [faculty, departments] = await Promise.all([
    getAllFaculty(),
    listDepartments(),
  ])

  const active = departments
    .filter((d) => d.isActive)
    .map((d) => ({ code: d.code, name: d.name }))

  return (
    <>
      <PageHeader
        title="Faculty"
        parent="Administration"
        parentHref="/dashboard/admin"
        description="Everyone on staff and the tier each one holds."
        actions={<AddFacultyDialog departments={active} />}
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
        />
      </div>
    </>
  )
}
