import { PageHeader } from "@/components/page-header"
import { StudentsClient } from "./client"
import {
  getAllStudents,
  getStudentCountsByDepartment,
  getStudentCountsByYear,
  getStudentCountsByDivision,
} from "@/db/queries"

export const dynamic = "force-dynamic"

export default async function StudentsPage() {
  const data = await getAllStudents()
  const departmentCounts = await getStudentCountsByDepartment()
  const yearCounts = await getStudentCountsByYear()
  const divisionCounts = await getStudentCountsByDivision()

  const safeDivisionCounts = divisionCounts.filter(
    (
      item
    ): item is {
      division: string
      count: number
    } => item.division !== null
  )

  return (
    <>
      <PageHeader
        title="All Students"
        parent="Students"
        parentHref="/dashboard/students"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <StudentsClient
          data={data}
          departmentCounts={departmentCounts}
          yearCounts={yearCounts}
          divisionCounts={safeDivisionCounts}
        />
      </div>
    </>
  )
}
