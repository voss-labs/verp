import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { listDepartments } from "@/db/queries/departments"
import {
  listCoursesForDepts,
  countOfferingsByCourse,
} from "@/db/queries/courses"
import { CoursesClient } from "./client"

export const dynamic = "force-dynamic"

export default async function CoursesPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "course:read")) redirect("/dashboard")

  const allDepts = await listDepartments()
  const scope =
    user.tier === "super_admin"
      ? allDepts.filter((d) => d.isActive).map((d) => d.code)
      : user.deptCodes

  const courses = await listCoursesForDepts(scope)
  // Offering counts drive the "in use" badge: a course already being taught can
  // still be edited, but the page says so before somebody changes its maxima.
  const usage = await countOfferingsByCourse(courses.map((c) => c.id))

  return (
    <>
      <PageHeader
        title="Course catalogue"
        parent="My Department"
        parentHref="/dashboard/dept"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <CoursesClient
          canEdit={can(user, "course:update")}
          courses={courses.map((c) => ({
            id: c.id,
            courseCode: c.courseCode,
            courseName: c.courseName,
            departmentCode: c.departmentCode,
            courseType: c.courseType,
            credits: c.credits,
            maxIsa: c.maxIsa,
            maxMse: c.maxMse,
            maxEse: c.maxEse,
            maxTotal: c.maxTotal,
            isActive: c.isActive,
            offerings: usage.get(c.id) ?? 0,
          }))}
        />
      </div>
    </>
  )
}
