import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { getStudentsByClassKeys } from "@/db/queries/students"
import { listOfferingsForClass } from "@/db/queries/offerings"
import { listBatchesForOffering } from "@/db/queries/batches"
import { BatchesClient } from "./client"

export const dynamic = "force-dynamic"

export default async function BatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>
  searchParams: Promise<{ offering?: string }>
}) {
  const { classId } = await params
  const { offering: offeringId } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "marks:write")) redirect("/dashboard")

  const cls = await getClassById(classId)
  if (!cls) return notFound()
  const inScope =
    user.tier === "super_admin" ||
    user.classIds.includes(classId) ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode))
  if (!inScope) redirect("/dashboard/class")

  // Batches only make sense for a lab: a theory lecture is delivered to the
  // whole division at once, so splitting it would be an empty ceremony.
  const offerings = (await listOfferingsForClass(classId)).filter(
    (o) => o.course.courseType !== "theory"
  )
  const selected = offeringId
    ? offerings.find((o) => o.id === offeringId)
    : offerings[0]

  const [students, batches] = await Promise.all([
    getStudentsByClassKeys([cls.classKey]),
    selected ? listBatchesForOffering(selected.id) : Promise.resolve([]),
  ])

  const yr = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  return (
    <>
      <PageHeader
        title={`Batches — ${yr} · ${cls.departmentCode} · ${cls.division}`}
        parent="My classes"
        parentHref={`/dashboard/class/${classId}`}
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <BatchesClient
          classId={classId}
          offerings={offerings.map((o) => ({
            id: o.id,
            code: o.course.courseCode,
            name: o.course.courseName,
          }))}
          selectedId={selected?.id ?? null}
          batches={batches.map((b) => ({
            id: b.id,
            name: b.name,
            students: b.assignments.map((a) => ({
              id: a.student.id,
              rollNumber: a.student.rollNumber,
              name: `${a.student.firstName} ${a.student.lastName}`.trim(),
            })),
          }))}
          roster={students.map((s) => ({
            id: s.id,
            rollNumber: s.rollNumber,
            name: `${s.firstName} ${s.lastName}`.trim(),
          }))}
        />
      </div>
    </>
  )
}
