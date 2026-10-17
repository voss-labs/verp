import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { can } from "@/lib/rbac"
import { rosterFrozenReason, studentsWithMarks } from "@/lib/electives"
import { getStudentsByClassKeys } from "@/db/queries/students"
import { listOfferingsForClass } from "@/db/queries/offerings"
import { getElectiveMemberIds } from "@/db/queries/electives"
import { getBatchedStudentIds } from "@/db/queries/batches"
import { getLockedComponents, getMarksForOffering } from "@/db/queries/marks"
import { ClassTabs } from "../class-tabs"
import { classTabs, classTrail, requireClassContext } from "../class-context"
import { ElectivesClient } from "./client"

export const dynamic = "force-dynamic"

export default async function ElectivesPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>
  searchParams: Promise<{ offering?: string }>
}) {
  const { classId } = await params
  const { offering: offeringId } = await searchParams
  const { user, cls, canAllocate, label } = await requireClassContext(classId)
  // Who takes an elective decides what "every student is marked" means for it,
  // which locking and publishing rest on, so it belongs to whoever allocates
  // the subject. A teacher sees the result where they work: the marks grid and
  // the register list the students taking it.
  if (!canAllocate || !can(user, "offering:update")) {
    redirect(`/dashboard/class/${classId}`)
  }

  const offerings = await listOfferingsForClass(classId)
  // An elective first when nothing is picked: this page is where they live.
  const selected =
    offerings.find((o) => o.id === offeringId) ??
    offerings.find((o) => o.isElective) ??
    offerings[0]

  const [roster, members, marks, locks, batched] = await Promise.all([
    getStudentsByClassKeys([cls.classKey]),
    selected
      ? getElectiveMemberIds(selected.id)
      : Promise.resolve(new Set<string>()),
    selected ? getMarksForOffering(selected.id) : Promise.resolve([]),
    selected ? getLockedComponents(selected.id) : Promise.resolve([]),
    selected
      ? getBatchedStudentIds(selected.id)
      : Promise.resolve(new Set<string>()),
  ])

  return (
    <>
      <PageHeader
        title={`Electives — ${label}`}
        trail={classTrail(cls, label)}
        parent="My classes"
        parentHref={`/dashboard/class/${classId}`}
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ClassTabs tabs={classTabs(classId, user, { canAllocate })} />
        <ElectivesClient
          key={selected?.id ?? "none"}
          classId={classId}
          classLabel={label}
          offerings={offerings.map((o) => ({
            id: o.id,
            code: o.course.courseCode,
            name: o.course.courseName,
            isElective: o.isElective,
            lab: o.course.courseType !== "theory",
          }))}
          selectedId={selected?.id ?? null}
          roster={roster.map((s) => ({
            id: s.id,
            rollNumber: s.rollNumber,
            name: `${s.firstName} ${s.lastName}`.trim(),
          }))}
          members={roster.filter((s) => members.has(s.id)).map((s) => s.id)}
          batched={roster.filter((s) => batched.has(s.id)).map((s) => s.id)}
          withMarks={studentsWithMarks(
            new Map(marks.map((m) => [m.studentId, m]))
          )}
          frozen={rosterFrozenReason({
            published: selected?.publishedAt != null,
            locked: locks.map((l) => l.component),
          })}
        />
      </div>
    </>
  )
}
