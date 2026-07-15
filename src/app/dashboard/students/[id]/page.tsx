import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getStudentById } from "@/db/queries/students"
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

  const studentName = `${student.firstName} ${student.lastName}`.trim()
  const claimed = student.authUserId !== null

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
          <Badge variant="outline">{student.year}</Badge>
          {student.division && (
            <Badge variant="outline">Div {student.division}</Badge>
          )}
          <Badge variant="outline">{student.department}</Badge>
          <Badge variant={claimed ? "default" : "secondary"}>
            {claimed ? "Claimed" : "Not yet claimed"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {student.email ??
            "No email yet — fills in when the student signs in with VOSS and claims this roll number."}
        </p>
      </div>
    </>
  )
}
