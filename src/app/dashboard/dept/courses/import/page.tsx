import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { listDepartments } from "@/db/queries/departments"
import { ImportClient } from "./client"

export const dynamic = "force-dynamic"

export default async function ImportCoursesPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "course:create")) redirect("/dashboard/dept/courses")

  const all = await listDepartments()
  const scope =
    user.tier === "super_admin"
      ? all.filter((d) => d.isActive).map((d) => d.code)
      : user.deptCodes
  const departments = all
    .filter((d) => scope.includes(d.code))
    .map((d) => ({ code: d.code, name: d.name }))

  if (departments.length === 0) redirect("/dashboard/dept/courses")

  return (
    <>
      <PageHeader
        title="Import syllabus"
        parent="Course catalogue"
        parentHref="/dashboard/dept/courses"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ImportClient departments={departments} />
      </div>
    </>
  )
}
