import { PageHeader } from "@/components/page-header"
import { AttendanceClient } from "./client"

export const dynamic = "force-dynamic"

export default async function AttendancePage() {
  return (
    <>
      <PageHeader
        title="Records"
        parent="Attendance"
        parentHref="/dashboard/attendance"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <AttendanceClient data={[]} />
      </div>
    </>
  )
}
