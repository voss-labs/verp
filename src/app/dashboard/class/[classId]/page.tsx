import { notFound, redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { expectedYear } from "@/lib/roll-number"
import { getClassById } from "@/db/queries/classes"
import { listPendingRequestsForClass } from "@/db/queries/onboarding"
import { QueueClient } from "./queue-client"

export const dynamic = "force-dynamic"

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const cls = await getClassById(classId)
  if (!cls) return notFound()

  const inScope =
    user.tier === "super_admin" ||
    user.classIds.includes(classId) ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode))
  if (!inScope) redirect("/dashboard/class")

  const requests = await listPendingRequestsForClass(classId)
  const yr = expectedYear(cls.admissionYear, new Date()) ?? cls.admissionYear
  const label = `${yr} · ${cls.departmentCode} · ${cls.division}`

  return (
    <>
      <PageHeader
        title={label}
        parent="My classes"
        parentHref="/dashboard/class"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div>
          <h3 className="text-sm font-medium">
            Enrolment requests ({requests.length})
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Students who claimed a roll number in {label}. Check each against
            your attendance sheet, then approve to link them.
          </p>
        </div>
        <QueueClient
          requests={requests.map((r) => ({
            id: r.id,
            rollNumber: r.rollNumber,
            name: `${r.firstName} ${r.lastName}`.trim(),
            email: r.email,
          }))}
        />
      </div>
    </>
  )
}
