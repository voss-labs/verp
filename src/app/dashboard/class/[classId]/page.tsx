import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { can } from "@/lib/rbac"
import { listPendingRequestsForClass } from "@/db/queries/onboarding"
import { listClassStaff } from "@/db/queries/class-staff"
import { getStudentsByClassKeys } from "@/db/queries/students"
import { listOfferingsForClass } from "@/db/queries/offerings"
import { countClassTeachers } from "@/lib/allocation"
import { QueueClient } from "./queue-client"
import { ClassTabs } from "./class-tabs"
import { classTabs, classTrail, requireClassContext } from "./class-context"
import { Attention, Completion, EmptyHint } from "../../overview-cards"

export const dynamic = "force-dynamic"

export default async function ClassOverviewPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  const { user, cls, canAllocate, label } = await requireClassContext(classId)

  const [requests, staff, roster, offerings] = await Promise.all([
    listPendingRequestsForClass(classId),
    listClassStaff([classId]),
    getStudentsByClassKeys([cls.classKey]),
    listOfferingsForClass(classId),
  ])

  const coordinator = staff.find((s) => s.role === "academic_coordinator")
  const teacherCount = countClassTeachers(
    staff,
    offerings.map((o) => o.faculty?.id ?? null)
  )
  const unallocated = offerings.filter((o) => !o.faculty).length
  const unclaimed = roster.filter((s) => !s.authUserId).length
  const canReachDept = can(user, "dept:read")

  return (
    <>
      <PageHeader
        title={label}
        trail={classTrail(cls, label)}
        parent="My classes"
        parentHref="/dashboard/class"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ClassTabs
          tabs={classTabs(classId, user, {
            canAllocate,
            pendingRequests: requests.length,
          })}
        />

        {/* Who runs this class, stated before the work it needs. */}
        <StatCardRow>
          <StatCard
            label="Class key"
            value={<span className="identifier">{cls.classKey}</span>}
          />
          <StatCard
            label="Coordinator"
            tone={coordinator ? "default" : "attention"}
            value={
              coordinator ? (
                <span className="text-base font-medium">
                  {`${coordinator.firstName} ${coordinator.lastName}`.trim()}
                </span>
              ) : (
                <span className="flex flex-col gap-1">
                  <span className="text-base font-medium">Unassigned</span>
                  {canReachDept && (
                    <Link
                      href="/dashboard/dept"
                      className="text-blue text-xs font-normal underline-offset-2 hover:underline"
                    >
                      Appoint one in My department
                    </Link>
                  )}
                </span>
              )
            }
          />
          <StatCard
            label="Teachers"
            value={teacherCount}
            tone={teacherCount === 0 ? "attention" : "default"}
            detail={
              teacherCount === 0 ? "Nobody teaches this class yet" : undefined
            }
          />
          <StatCard
            label="Students"
            value={roster.length}
            detail={unclaimed > 0 ? `${unclaimed} not signed in` : undefined}
          />
        </StatCardRow>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Attention
              count={requests.length}
              label="Enrolment requests"
              href={`/dashboard/class/${classId}`}
            />
            <Attention
              count={unallocated}
              label="Subjects with no teacher"
              href={`/dashboard/class/${classId}/subjects`}
              tone={canAllocate ? "attention" : "neutral"}
            />
            <Attention
              count={unclaimed}
              label="Students yet to sign in"
              href="/dashboard/students"
              tone="neutral"
            />
          </div>
          {offerings.length > 0 && (
            <Completion
              done={offerings.filter((o) => o.faculty).length}
              total={offerings.length}
              noun="subjects allocated"
            />
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            Enrolment requests ({requests.length})
          </h2>
          {requests.length === 0 ? (
            <EmptyHint>
              No students are waiting to be approved for {label}.
            </EmptyHint>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Students who claimed a roll number in {label}. Check each against
              your attendance sheet, then approve to link them.
            </p>
          )}
          <QueueClient
            requests={requests.map((r) => ({
              id: r.id,
              rollNumber: r.rollNumber,
              name: `${r.firstName} ${r.lastName}`.trim(),
              email: r.email,
            }))}
          />
        </section>
      </div>
    </>
  )
}
