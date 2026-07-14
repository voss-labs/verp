import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { MarksOverviewClient } from "./client"
import {
  getAllCourseOfferings,
  getCourseOfferingsByFaculty,
  getCurrentSemester,
} from "@/db/queries"
import { getSessionUser, isStaff } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function MarksPage() {
  const user = await getSessionUser()
  if (!user) return redirect("/login")

  if (!isStaff(user)) {
    return redirect("/dashboard/my-marks")
  }

  const semester = await getCurrentSemester()

  let offerings: Awaited<ReturnType<typeof getAllCourseOfferings>> = []
  if (semester) {
    if (user.role === "faculty" && user.facultyId) {
      offerings = await getCourseOfferingsByFaculty(user.facultyId, semester.id)
    } else {
      offerings = await getAllCourseOfferings(semester.id)
    }
  }

  return (
    <>
      <PageHeader
        title="Marks Management"
        parent="Marks"
        parentHref="/dashboard/marks"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <MarksOverviewClient
          offerings={offerings}
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
