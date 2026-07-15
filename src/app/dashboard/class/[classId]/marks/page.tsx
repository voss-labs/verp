import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { getStudentsByClassIds } from "@/db/queries/students"
import {
  listOfferingsForClass,
  getOfferingById,
} from "@/db/queries/offerings"
import { getMarksForOffering } from "@/db/queries/marks"
import { MarksClient } from "./client"

export const dynamic = "force-dynamic"

export default async function MarksPage({
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

  const offerings = await listOfferingsForClass(classId)
  const yr = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  const label = `${yr} · ${cls.departmentCode} · ${cls.division}`

  // If a subject is selected, load its grid data.
  let grid = null
  const selected =
    offeringId && offerings.find((o) => o.id === offeringId)
      ? await getOfferingById(offeringId)
      : null
  if (selected) {
    const [students, existing] = await Promise.all([
      getStudentsByClassIds([classId]),
      getMarksForOffering(selected.id),
    ])
    const byStudent = Object.fromEntries(existing.map((m) => [m.studentId, m]))
    grid = {
      offeringId: selected.id,
      course: {
        courseType: selected.course.courseType,
        credits: selected.course.credits,
        maxIsa: selected.course.maxIsa,
        maxMse: selected.course.maxMse,
        maxEse: selected.course.maxEse,
        maxTotal: selected.course.maxTotal,
      },
      rows: students.map((s) => ({
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        rollNumber: s.rollNumber,
        isa: byStudent[s.id]?.isa ?? null,
        mse1: byStudent[s.id]?.mse1 ?? null,
        mse2: byStudent[s.id]?.mse2 ?? null,
        ese: byStudent[s.id]?.ese ?? null,
      })),
    }
  }

  return (
    <>
      <PageHeader
        title={`Marks — ${label}`}
        parent="My classes"
        parentHref={`/dashboard/class/${classId}`}
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <MarksClient
          classId={classId}
          offerings={offerings.map((o) => ({
            id: o.id,
            code: o.course.courseCode,
            name: o.course.courseName,
            semester: o.semester,
          }))}
          selectedId={grid?.offeringId ?? null}
          grid={grid}
        />
      </div>
    </>
  )
}
