import { PageHeader } from "@/components/page-header"
import { DepartmentsClient } from "./client"
import { getAllDepartments } from "@/db/queries"

export const dynamic = "force-dynamic"

export default async function DepartmentsPage() {
  const data = await getAllDepartments()

  return (
    <>
      <PageHeader
        title="All Departments"
        parent="Departments"
        parentHref="/dashboard/departments"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <DepartmentsClient data={data} />
      </div>
    </>
  )
}
