import { PageHeader } from "@/components/page-header"
import { CgpaClient } from "./client"
import { getAllStudents, getAllMarks } from "@/db/queries"

export const dynamic = "force-dynamic"

type SemesterMarks = {
  semesterNumber: number
  academicYear: string
  courses: {
    courseCode: string
    courseName: string
    courseType: string
    credits: number
    maxIsa: number
    maxMse: number
    maxEse: number
    maxTotal: number
    isa: number | null
    mse1: number | null
    mse2: number | null
    ese: number | null
  }[]
}

export default async function CgpaPage() {
  const [students, allMarks] = await Promise.all([
    getAllStudents(),
    getAllMarks(),
  ])

  // Group marks by student → semester
  const marksByStudent = new Map<string, Map<number, typeof allMarks>>()
  for (const m of allMarks) {
    const sid = m.studentId
    const semId = m.courseOffering.semesterId
    if (!marksByStudent.has(sid)) marksByStudent.set(sid, new Map())
    const semMap = marksByStudent.get(sid)!
    if (!semMap.has(semId)) semMap.set(semId, [])
    semMap.get(semId)!.push(m)
  }

  const studentData = students.map((student) => {
    const semMap = marksByStudent.get(student.id)
    const semesters: SemesterMarks[] = []

    if (semMap) {
      for (const [, marks] of semMap) {
        const sem = marks[0].courseOffering.semester
        semesters.push({
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
        })
      }
      semesters.sort((a, b) => a.semesterNumber - b.semesterNumber)
    }

    return {
      studentId: student.id,
      rollNumber: student.rollNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      division: student.division,
      semesters,
    }
  })

  // Collect unique divisions for filter
  const divisions = [
    ...new Set(students.map((s) => s.division).filter(Boolean)),
  ] as string[]
  divisions.sort()

  return (
    <>
      <PageHeader
        title="CGPA Calculator"
        parent="Academics"
        parentHref="/dashboard"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <CgpaClient students={studentData} divisions={divisions} />
      </div>
    </>
  )
}
