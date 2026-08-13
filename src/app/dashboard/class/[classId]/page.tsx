import { PageHeader } from "@/components/page-header"
import { listPendingRequestsForClass } from "@/db/queries/onboarding"
import { listClassStaff } from "@/db/queries/class-staff"
import { getStudentsByClassKeys } from "@/db/queries/students"
import { listOfferingsForClass } from "@/db/queries/offerings"
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
  const teachers = staff.filter((s) => s.role === "tr")
  const unallocated = offerings.filter((o) => !o.faculty).length
  const unclaimed = roster.filter((s) => !s.authUserId).length

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Class key" value={cls.classKey} mono />
          <Fact
            label="Coordinator"
            value={
              coordinator
                ? `${coordinator.firstName} ${coordinator.lastName}`.trim()
                : "Unassigned"
            }
            warn={!coordinator}
          />
          <Fact
            label="Teachers"
            value={teachers.length ? String(teachers.length) : "None"}
            warn={teachers.length === 0}
          />
          <Fact
            label="Students"
            value={String(roster.length)}
            hint={unclaimed > 0 ? `${unclaimed} not signed in` : undefined}
          />
        </div>

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

function Fact({
  label,
  value,
  hint,
  mono,
  warn,
}: {
  label: string
  value: string
  hint?: string
  mono?: boolean
  warn?: boolean
}) {
  return (
    <div className="border-border rounded border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={[
          "mt-0.5 text-sm font-medium",
          mono ? "identifier" : "",
          warn ? "text-destructive" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
    </div>
  )
}
