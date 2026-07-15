import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { MarksEntryClient } from "./client"
import {
  getCourseOfferingById,
  getMarksByCourseOffering,
  getEnrollmentsByCourseOffering,
  getMarksLock,
  getBatchesByCourseOffering,
} from "@/db/queries"

export const dynamic = "force-dynamic"

export default async function MarksEntryPage({
  params,
}: {
  params: Promise<{ offeringId: string }>
}) {
  const { offeringId } = await params
  const offering = await getCourseOfferingById(offeringId)

  if (!offering) return notFound()

  const [enrollments, existingMarks, lockAll, batchesData] = await Promise.all([
    getEnrollmentsByCourseOffering(offeringId),
    getMarksByCourseOffering(offeringId),
    getMarksLock(offeringId, "all"),
    getBatchesByCourseOffering(offeringId),
  ])

  const marksMap = new Map(existingMarks.map((m) => [m.studentId, m]))

  const studentsWithMarks = enrollments.map((e) => {
    const m = marksMap.get(e.studentId)
    return {
      studentId: e.studentId,
      rollNumber: e.student.rollNumber,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      division: e.student.division,
      isa: m?.isa ?? null,
      mse1: m?.mse1 ?? null,
      mse2: m?.mse2 ?? null,
      ese: m?.ese ?? null,
    }
  })

  studentsWithMarks.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber))

  const batchMap = batchesData
    .filter((b) => b.isActive)
    .map((b) => ({
      name: b.name,
      studentIds: b.assignments
        .filter((a) => a.isActive)
        .map((a) => a.studentId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader
        title={`${offering.course.courseCode} - ${offering.course.courseName}`}
        parent="Marks"
        parentHref="/dashboard/marks"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <MarksEntryClient
          offeringId={offeringId}
          courseCode={offering.course.courseCode}
          courseName={offering.course.courseName}
          courseType={offering.course.courseType}
          maxIsa={offering.course.maxIsa}
          maxMse={offering.course.maxMse}
          maxEse={offering.course.maxEse}
          maxTotal={offering.course.maxTotal}
          students={studentsWithMarks}
          division={offering.division}
          facultyName={
            offering.faculty
              ? `${offering.faculty.firstName} ${offering.faculty.lastName}`
              : "Unassigned"
          }
          isLocked={lockAll?.isLocked ?? false}
          batches={batchMap}
        />
      </div>
    </>
  )
}
