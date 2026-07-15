import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { FacultyClient } from "./client"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { getAllFaculty, getFacultyByDepartments } from "@/db/queries/faculty"

export const dynamic = "force-dynamic"

export default async function FacultyPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  // Only HOD (own dept) and super_admin (all) read the faculty roster; a plain
  // coordinator or a student cannot, by URL or nav.
  if (!can(user, "faculty:read")) redirect("/dashboard")

  const data =
    user.tier === "super_admin"
      ? await getAllFaculty()
      : await getFacultyByDepartments(user.deptCodes)

  return (
    <>
      <PageHeader
        title="All Faculty"
        parent="Faculty"
        parentHref="/dashboard/faculty"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <FacultyClient data={data} />
      </div>
    </>
  )
}
