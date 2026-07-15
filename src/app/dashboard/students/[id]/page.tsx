import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getStudentById } from "@/db/queries/students"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "student:read")) redirect("/dashboard")

  const student = await getStudentById(id)
  if (!student) return notFound()

  // Scope: the record must be within the viewer's reach — their class (coordinator)
  // or department (HOD); super_admin sees any.
  const inScope =
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(student.department)) ||
    (!!student.classId && user.classIds.includes(student.classId))
  if (!inScope) redirect("/dashboard/students")

  const studentName = `${student.firstName} ${student.lastName}`.trim()
  const claimed = student.authUserId !== null
  const initials = (
    (student.firstName[0] ?? "") + (student.lastName[0] ?? "")
  ).toUpperCase()

  const facts: { label: string; value: string }[] = [
    { label: "Roll number", value: student.rollNumber },
    { label: "Department", value: student.department },
    { label: "Division", value: student.division ?? "—" },
    { label: "Year", value: student.year },
    { label: "Email", value: student.email ?? "Not yet claimed" },
    { label: "Status", value: student.isActive ? "Active" : "Inactive" },
  ]

  return (
    <>
      <PageHeader
        title={studentName}
        parent="Students"
        parentHref="/dashboard/students"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="border-border bg-card max-w-2xl rounded border">
          {/* Header band */}
          <div className="border-border flex items-center gap-4 border-b p-5">
            <div className="bg-primary text-primary-foreground flex size-14 shrink-0 items-center justify-center rounded text-lg font-semibold">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {studentName}
              </h2>
              <p className="text-muted-foreground font-mono text-sm">
                {student.rollNumber}
              </p>
            </div>
            <Badge
              variant={claimed ? "default" : "secondary"}
              className="ml-auto"
            >
              {claimed ? "Claimed" : "Pending"}
            </Badge>
          </div>

          {/* Facts */}
          <dl className="divide-border divide-y">
            {facts.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <dt className="text-muted-foreground text-sm">{f.label}</dt>
                <dd className="truncate text-right text-sm font-medium">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  )
}
