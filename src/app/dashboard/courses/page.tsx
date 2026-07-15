import { PageHeader } from "@/components/page-header"
import { CoursesClient } from "./client"
import { getAllCourses } from "@/db/queries"

export const dynamic = "force-dynamic"

export default async function CoursesPage() {
  const data = await getAllCourses()

  return (
    <>
      <PageHeader
        title="All Courses"
        parent="Courses"
        parentHref="/dashboard/courses"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <CoursesClient data={data} />
      </div>
    </>
  )
}
