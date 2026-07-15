import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { OfferingDetailClient } from "./client"
import {
  getCourseOfferingById,
  getAllStudents,
  getBatchesByCourseOffering,
} from "@/db/queries"

export const dynamic = "force-dynamic"

export default async function OfferingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const offering = await getCourseOfferingById(id)
  if (!offering) return notFound()

  const [allStudents, batches] = await Promise.all([
    getAllStudents(),
    getBatchesByCourseOffering(id),
  ])

  const enrolledIds = new Set(offering.enrollments.map((e) => e.studentId))

  const enrolledStudents = offering.enrollments
    .filter((e) => e.isActive)
    .map((e) => ({
      id: e.student.id,
      rollNumber: e.student.rollNumber,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      division: e.student.division,
    }))
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber))

  const availableStudents = allStudents
    .filter((s) => !enrolledIds.has(s.id))
    .map((s) => ({
      id: s.id,
      rollNumber: s.rollNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      division: s.division,
    }))
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber))

  const batchData = batches.map((b) => ({
    id: b.id,
    name: b.name,
    students: b.assignments
      .filter((a) => a.isActive)
      .map((a) => ({
        id: a.student.id,
        rollNumber: a.student.rollNumber,
        firstName: a.student.firstName,
        lastName: a.student.lastName,
      })),
  }))

  return (
    <>
      <PageHeader
        title={`${offering.course.courseCode} - ${offering.course.courseName}`}
        parent="Offerings"
        parentHref="/dashboard/offerings"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <OfferingDetailClient
          offeringId={id}
          courseType={offering.course.courseType}
          division={offering.division}
          enrolledStudents={enrolledStudents}
          availableStudents={availableStudents}
          batches={batchData}
        />
      </div>
    </>
  )
}
