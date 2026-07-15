import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { MyMarksClient } from "./client"
import { getSessionUser } from "@/lib/session"
import { getMarksByStudent } from "@/db/queries/marks"
import { getStudentById } from "@/db/queries/students"

export const dynamic = "force-dynamic"

export default async function MyMarksPage() {
  const user = await getSessionUser()
  if (!user) return redirect("/login")

  if (user.role !== "student" || !user.studentId) {
    return (
      <>
        <PageHeader title="My Marks" />
        <div className="p-4 lg:p-6">
          <p className="text-muted-foreground text-sm">
            This page is only accessible to students.
          </p>
        </div>
      </>
    )
  }

  const student = await getStudentById(user.studentId)
  if (!student) return redirect("/login")

  const allMarks = await getMarksByStudent(user.studentId)

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

  return (
    <>
      <PageHeader title="My Marks" parent="Dashboard" parentHref="/dashboard" />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <MyMarksClient
          studentName={`${student.firstName} ${student.lastName}`}
          rollNumber={student.rollNumber}
          semesters={semesters}
        />
      </div>
    </>
  )
}
