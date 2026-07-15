import { PageHeader } from "@/components/page-header"
import { listDepartments } from "@/db/queries/departments"
import { DepartmentsClient } from "./client"

export const dynamic = "force-dynamic"

export default async function DepartmentsPage() {
  const departments = await listDepartments()
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
          }))}
        />
      </div>
    </>
  )
}
