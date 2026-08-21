import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { listOfferingsForClass } from "@/db/queries/offerings"
import { ImportClient } from "./client"

export const dynamic = "force-dynamic"

export default async function MarksImportPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "marks:write")) redirect("/dashboard")

  const cls = await getClassById(classId)
  if (!cls) return notFound()
  const inScope =
    user.tier === "super_admin" ||
    user.classIds.includes(classId) ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode))
  if (!inScope) redirect("/dashboard/class?denied=class")

  // Same rule as the marks grid: a coordinator or HOD runs the whole timetable,
  // a TR gets the subjects handed to them. Offering the rest would let someone
  // do the work of a full import before being told the subject is not theirs.
  const canAllocate =
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode)) ||
    user.coordinatorClassIds.includes(classId)
  const offerings = canAllocate
    ? await listOfferingsForClass(classId)
    : await listOfferingsForClass(classId, user.facultyId ?? undefined)
  const yr = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  const label = `${yr} · ${cls.departmentCode} · ${cls.division}`

  return (
    <>
      <PageHeader
        title={`Import marks — ${label}`}
        parent="Marks"
        parentHref={`/dashboard/class/${classId}/marks`}
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ImportClient
          classId={classId}
          canAllocate={canAllocate}
          offerings={offerings.map((o) => ({
            id: o.id,
            code: o.course.courseCode,
            name: o.course.courseName,
          }))}
        />
      </div>
    </>
  )
}
