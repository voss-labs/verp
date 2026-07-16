import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { listDepartments } from "@/db/queries/departments"
import { listClassesForDepts } from "@/db/queries/classes"
import { FacultyImportClient } from "./client"

export const dynamic = "force-dynamic"

export default async function FacultyImportPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "faculty:create")) redirect("/dashboard")

  const allDepts = await listDepartments()
  const scope =
    user.tier === "super_admin"
      ? allDepts.filter((d) => d.isActive).map((d) => d.code)
      : user.deptCodes
  const depts = allDepts.filter((d) => scope.includes(d.code))
  const classes = await listClassesForDepts(scope)
  const now = new Date()

  return (
    <>
      <PageHeader
        title="Import faculty"
        parent="My department"
        parentHref="/dashboard/dept"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <FacultyImportClient
          departments={depts.map((d) => ({ code: d.code, name: d.name }))}
          classes={classes.map((c) => ({
            id: c.id,
            departmentCode: c.departmentCode,
            label: `${expectedYear(c.admissionYear, now) ?? c.admissionYear} · ${c.departmentCode} · ${c.division}`,
          }))}
        />
      </div>
    </>
  )
}
