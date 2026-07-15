import { PageHeader } from "@/components/page-header"
import { OfferingsClient } from "./client"
import {
  getAllCourseOfferings,
  getCurrentSemester,
  getAllFaculty,
} from "@/db/queries"

export const dynamic = "force-dynamic"

export default async function OfferingsPage() {
  const semester = await getCurrentSemester()
  const [data, faculty] = await Promise.all([
    semester ? getAllCourseOfferings(semester.id) : Promise.resolve([]),
    getAllFaculty(),
  ])

  return (
    <>
      <PageHeader
        title="Course Offerings"
        parent="Academics"
        parentHref="/dashboard/offerings"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <OfferingsClient
          data={data}
          faculty={faculty.map((f) => ({
            id: f.id,
            name: `${f.firstName} ${f.lastName}`,
          }))}
          semesterLabel={
            semester
              ? `Sem ${semester.number} (${semester.academicYear.name})`
              : "No active semester"
          }
        />
      </div>
    </>
  )
}
