import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { getMarksForStudent } from "@/db/queries/marks"
import { computeCgpa, groupBySemester } from "@/lib/sgpi"
import { MyMarksClient } from "./client"

export const dynamic = "force-dynamic"

export default async function MyMarksPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  // Staff have no marks of their own; the dashboard is where they belong.
  if (!user.studentId) redirect("/dashboard")

  const rows = await getMarksForStudent(user.studentId)
  const flat = rows.map((m) => ({
    semester: m.courseOffering.semester,
    marks: { isa: m.isa, mse1: m.mse1, mse2: m.mse2, ese: m.ese },
    course: {
      courseType: m.courseOffering.course.courseType,
      credits: m.courseOffering.course.credits,
      maxIsa: m.courseOffering.course.maxIsa,
      maxMse: m.courseOffering.course.maxMse,
      maxEse: m.courseOffering.course.maxEse,
      maxTotal: m.courseOffering.course.maxTotal,
    },
  }))
  const cgpa = computeCgpa(groupBySemester(flat))

  // Same grouping as the CGPA maths, but carrying the labels the page renders.
  const semesters = [...new Set(flat.map((f) => f.semester))]
    .sort((a, b) => a - b)
    .map((semester) => ({
      semester,
      subjects: rows
        .filter((m) => m.courseOffering.semester === semester)
        .map((m) => ({
          code: m.courseOffering.course.courseCode,
          name: m.courseOffering.course.courseName,
          credits: m.courseOffering.course.credits,
          marks: { isa: m.isa, mse1: m.mse1, mse2: m.mse2, ese: m.ese },
          course: {
            courseType: m.courseOffering.course.courseType,
            credits: m.courseOffering.course.credits,
            maxIsa: m.courseOffering.course.maxIsa,
            maxMse: m.courseOffering.course.maxMse,
            maxEse: m.courseOffering.course.maxEse,
            maxTotal: m.courseOffering.course.maxTotal,
          },
        })),
    }))

  return (
    <>
      <PageHeader title="My marks" />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <MyMarksClient cgpa={cgpa} semesters={semesters} />
      </div>
    </>
  )
}
