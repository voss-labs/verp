import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ClassTabs } from "../class-tabs"
import { classTabs, classTrail } from "../class-context"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear, semestersForClass } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import { listOfferingsForClass } from "@/db/queries/offerings"
import { listCoursesForDepts } from "@/db/queries/courses"
import { classTeacherOptions } from "@/lib/allocation"
import { SubjectsClient } from "./client"

export const dynamic = "force-dynamic"

export default async function SubjectsPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const user = await getSessionUser()
  if (!user) redirect("/login")
  // offering:read, not marks:read — an HOD allocates subjects without ever
  // entering a mark, and the marks pages are gated on marks:write.
  if (!can(user, "offering:read")) redirect("/dashboard")

  const cls = await getClassById(classId)
  if (!cls) return notFound()

  const canAllocate =
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode)) ||
    user.coordinatorClassIds.includes(classId)
  const inScope = canAllocate || user.classIds.includes(classId)
  if (!inScope) redirect("/dashboard/class?denied=class")

  const yr = expectedYear(cls.admissionYear, new Date())
  const label = `${yr} · ${cls.departmentCode} · ${cls.division}`
  const [offerings, staff, catalogue] = await Promise.all([
    listOfferingsForClass(classId),
    listClassStaff([classId]),
    listCoursesForDepts([cls.departmentCode]),
  ])

  const taken = new Set(offerings.map((o) => o.course.courseCode))
  const teachers = classTeacherOptions(
    staff.map((s) => ({
      facultyId: s.facultyId,
      name: `${s.firstName} ${s.lastName}`.trim(),
      role: s.role,
    })),
    offerings.flatMap((o) =>
      o.faculty
        ? [
            {
              facultyId: o.faculty.id,
              name: `${o.faculty.firstName} ${o.faculty.lastName}`.trim(),
            },
          ]
        : []
    )
  )
  return (
    <>
      <PageHeader
        title={`Subjects — ${yr ?? cls.admissionYear} · ${cls.departmentCode} · ${cls.division}`}
        trail={classTrail(cls, label)}
        parent="My classes"
        parentHref={`/dashboard/class/${classId}`}
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ClassTabs tabs={classTabs(classId, user, { canAllocate })} />
        <SubjectsClient
          classId={classId}
          canAllocate={canAllocate}
          classYear={yr ?? null}
          semesters={semestersForClass(cls.admissionYear, new Date()) ?? [1, 2]}
          offerings={offerings.map((o) => ({
            id: o.id,
            code: o.course.courseCode,
            name: o.course.courseName,
            semester: o.semester,
            credits: o.course.credits,
            maxIsa: o.course.maxIsa,
            maxMse: o.course.maxMse,
            maxEse: o.course.maxEse,
            maxTotal: o.course.maxTotal,
            facultyId: o.faculty?.id ?? null,
            facultyName: o.faculty
              ? `${o.faculty.firstName} ${o.faculty.lastName}`.trim()
              : null,
          }))}
          teachers={teachers}
          // Only what this class could still be given: its own department's
          // catalogue, minus what it already has.
          catalogue={catalogue
            .filter((c) => c.isActive && !taken.has(c.courseCode))
            .map((c) => ({
              code: c.courseCode,
              name: c.courseName,
              type: c.courseType,
              credits: c.credits,
              year: c.year,
              maxIsa: c.maxIsa,
              maxMse: c.maxMse,
              maxEse: c.maxEse,
              maxTotal: c.maxTotal,
            }))}
        />
      </div>
    </>
  )
}
