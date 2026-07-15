import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { StudentsClient } from "./client"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import {
  getAllStudents,
  getStudentsByClassIds,
  getStudentsByDepartments,
} from "@/db/queries/students"

export const dynamic = "force-dynamic"

export default async function StudentsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  // A student has no student:read — they can never reach the roster, by URL or nav.
  if (!can(user, "student:read")) redirect("/dashboard")

  // Scoped: super_admin sees all, an HOD their department, a coordinator only the
  // classes they run. The capability says "may read students"; scope says "which".
  const data =
    user.tier === "super_admin"
      ? await getAllStudents()
      : user.tier === "hod"
        ? await getStudentsByDepartments(user.deptCodes)
        : await getStudentsByClassIds(user.classIds)

  return (
    <>
      <PageHeader
        title="All Students"
        parent="Students"
        parentHref="/dashboard/students"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <StudentsClient
          data={data}
          canDeactivate={can(user, "student:deactivate")}
        />
      </div>
    </>
  )
}
