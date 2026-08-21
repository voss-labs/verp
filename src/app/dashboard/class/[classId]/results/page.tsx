import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ClassTabs } from "../class-tabs"
import { classTabs, classTrail } from "../class-context"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { getStudentsByClassKeys } from "@/db/queries/students"
import { getMarksForClass } from "@/db/queries/marks"
import { computeCgpa, groupBySemester } from "@/lib/sgpi"
import { ResultsClient } from "./client"

export const dynamic = "force-dynamic"

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "marks:read")) redirect("/dashboard")

  const cls = await getClassById(classId)
  if (!cls) return notFound()
  const canAllocate =
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode)) ||
    user.coordinatorClassIds.includes(classId)
  const inScope =
    user.tier === "super_admin" ||
    user.classIds.includes(classId) ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode))
  if (!inScope) redirect("/dashboard/class?denied=class")

  const [students, rows] = await Promise.all([
    getStudentsByClassKeys([cls.classKey]),
    getMarksForClass(classId),
  ])

  // Roster-first: a student with no marks yet still belongs in the table, as a
  // blank row. Dropping them would hide exactly the people worth chasing.
  const byStudent = new Map<string, typeof rows>()
  for (const r of rows) {
    const list = byStudent.get(r.studentId) ?? []
    list.push(r)
    byStudent.set(r.studentId, list)
  }

  const table = students.map((s) => {
    const mine = byStudent.get(s.id) ?? []
    const cgpa = computeCgpa(
      groupBySemester(
        mine.map((m) => ({
          semester: m.semester,
          marks: { isa: m.isa, mse1: m.mse1, mse2: m.mse2, ese: m.ese },
          course: {
            courseType: m.courseType,
            credits: m.credits,
            maxIsa: m.maxIsa,
            maxMse: m.maxMse,
            maxEse: m.maxEse,
            maxTotal: m.maxTotal,
          },
        }))
      )
    )
    return {
      studentId: s.id,
      rollNumber: s.rollNumber,
      name: `${s.firstName} ${s.lastName}`.trim(),
      cgpa: cgpa.cgpa,
      hasFail: cgpa.hasFail,
      totalCredits: cgpa.totalCredits,
      semesters: cgpa.completedSemesters,
      subjects: mine.map((m) => ({
        semester: m.semester,
        code: m.courseCode,
        name: m.courseName,
        marks: { isa: m.isa, mse1: m.mse1, mse2: m.mse2, ese: m.ese },
        course: {
          courseType: m.courseType,
          credits: m.credits,
          maxIsa: m.maxIsa,
          maxMse: m.maxMse,
          maxEse: m.maxEse,
          maxTotal: m.maxTotal,
        },
      })),
    }
  })

  const yr = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  const label = `${yr} · ${cls.departmentCode} · ${cls.division}`
  return (
    <>
      <PageHeader
        title={`Results — ${yr} · ${cls.departmentCode} · ${cls.division}`}
        trail={classTrail(cls, label)}
        parent="My classes"
        parentHref={`/dashboard/class/${classId}`}
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ClassTabs tabs={classTabs(classId, user, { canAllocate })} />
        <ResultsClient rows={table} classLabel={`${cls.classKey}`} />
      </div>
    </>
  )
}
