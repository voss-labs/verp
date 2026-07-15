import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { MyMarksClient } from "@/app/dashboard/my-marks/client"
import { getStudentById } from "@/db/queries/students"
import { getMarksByStudent } from "@/db/queries/marks"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const student = await getStudentById(id)
  if (!student) return notFound()

  const allMarks = await getMarksByStudent(id)

  const bySemester = new Map<number, typeof allMarks>()
  for (const m of allMarks) {
    const semId = m.courseOffering.semesterId
    if (!bySemester.has(semId)) bySemester.set(semId, [])
    bySemester.get(semId)!.push(m)
  }

  const semesters = Array.from(bySemester.entries())
    .map(([semesterId, marks]) => {
      const sem = marks[0].courseOffering.semester
      return {
        semesterId,
        semesterNumber: sem.number,
        academicYear: sem.academicYear.name,
        courses: marks.map((m) => ({
          courseCode: m.courseOffering.course.courseCode,
          courseName: m.courseOffering.course.courseName,
          courseType: m.courseOffering.course.courseType,
          credits: m.courseOffering.course.credits,
          maxIsa: m.courseOffering.course.maxIsa,
          maxMse: m.courseOffering.course.maxMse,
          maxEse: m.courseOffering.course.maxEse,
          maxTotal: m.courseOffering.course.maxTotal,
          isa: m.isa,
          mse1: m.mse1,
          mse2: m.mse2,
          ese: m.ese,
        })),
      }
    })
    .sort((a, b) => b.semesterNumber - a.semesterNumber)

  const studentName = `${student.firstName} ${student.lastName}`

  return (
    <>
      <PageHeader
        title={studentName}
        parent="Students"
        parentHref="/dashboard/students"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge variant="outline" className="font-mono">
            {student.rollNumber}
          </Badge>
          {student.division && (
            <Badge variant="outline">Div {student.division}</Badge>
          )}
          <Badge variant="outline">{student.department}</Badge>
          <span className="text-muted-foreground">{student.email}</span>
        </div>
        <MyMarksClient
          studentName={studentName}
          rollNumber={student.rollNumber}
          semesters={semesters}
        />
      </div>
    </>
  )
}
