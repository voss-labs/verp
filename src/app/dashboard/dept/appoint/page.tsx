import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { listDepartments } from "@/db/queries/departments"
import { listClassesForDepts } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { listOfferingsForClass } from "@/db/queries/offerings"
import { listCoursesForDepts } from "@/db/queries/courses"
import { getFacultyByDepartments } from "@/db/queries/faculty"
import { AppointClient } from "./client"

export const dynamic = "force-dynamic"

export default async function AppointPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  // Appointing staff is assignment work; allocating them subjects is offering
  // work. Both live on this page, so both capabilities gate it.
  if (!can(user, "assignment:create") || !can(user, "offering:create")) {
    redirect("/dashboard/dept")
  }

  const all = await listDepartments()
  const scope =
    user.tier === "super_admin"
      ? all.filter((d) => d.isActive).map((d) => d.code)
      : user.deptCodes
  if (scope.length === 0) redirect("/dashboard/dept")

  const [faculty, classes, catalogue] = await Promise.all([
    getFacultyByDepartments(scope),
    listClassesForDepts(scope),
    listCoursesForDepts(scope),
  ])
  const active = classes.filter((c) => c.isActive)
  const staff = await listClassStaff(active.map((c) => c.id))

  // One read per class rather than a join: a department has a handful of
  // divisions, and this keeps the shape the page renders obvious.
  const offeringsByClass = await Promise.all(
    active.map(async (c) => ({
      classId: c.id,
      offerings: await listOfferingsForClass(c.id),
    }))
  )

  const now = new Date()
  return (
    <>
      <PageHeader
        title="Appoint faculty"
        parent="My department"
        parentHref="/dashboard/dept"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <AppointClient
          faculty={faculty.map((f) => ({
            id: f.id,
            name: `${f.firstName} ${f.lastName}`.trim(),
            email: f.email,
            department: f.department,
            tier: f.role,
            claimed: Boolean(f.authUserId),
          }))}
          classes={active.map((c) => ({
            id: c.id,
            departmentCode: c.departmentCode,
            label: `${expectedYear(c.admissionYear, now) ?? c.admissionYear} · ${c.departmentCode} · ${c.division}`,
            classKey: c.classKey,
          }))}
          staff={staff.map((s) => ({
            classId: s.classId,
            facultyId: s.facultyId,
            role: s.role,
          }))}
          offerings={offeringsByClass.flatMap((x) =>
            x.offerings.map((o) => ({
              id: o.id,
              classId: x.classId,
              code: o.course.courseCode,
              name: o.course.courseName,
              facultyId: o.faculty?.id ?? null,
            }))
          )}
          courses={catalogue
            .filter((c) => c.isActive)
            .map((c) => ({
              id: c.id,
              code: c.courseCode,
              name: c.courseName,
              year: c.year,
              departmentCode: c.departmentCode,
            }))}
        />
      </div>
    </>
  )
}
