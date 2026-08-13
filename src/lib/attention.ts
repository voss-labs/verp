// The attention inbox (spec 4.5).
//
// The overview already answers "how are my classes doing". It does not answer
// "what should I do next", and those are different questions: the facts are
// spread across per-class cards and per-department rows, so the one thing
// blocking a hundred students sits in the same visual weight as a cosmetic gap.
//
// This ranks the same already-fetched facts into one list. It deliberately
// issues no queries — a second data path would be a second thing to keep in
// scope, and everything needed is on screen already.

import type { ClassWork, DeptHealth } from "@/db/queries/overview"

/**
 * How much a thing matters, which is not how big its number is.
 *
 * "blocking" means somebody else cannot proceed until this person acts: a
 * student waiting on an enrolment decision has no way to make progress alone.
 * "overdue" is work that should already have happened. "open" is real but
 * nobody is stuck. Sorting by count instead would put forty missing marks above
 * one unstaffed class, and the unstaffed class is why the marks are missing.
 */
export type Urgency = "blocking" | "overdue" | "open"

export type AttentionItem = {
  id: string
  urgency: Urgency
  title: string
  detail: string
  href: string
  count: number
}

const RANK: Record<Urgency, number> = { blocking: 0, overdue: 1, open: 2 }

const plural = (n: number, one: string, many = `${one}s`) =>
  n === 1 ? one : many

export function buildAttention(input: {
  classWork: ClassWork[]
  deptHealth: DeptHealth[]
  /** Roster size is the yardstick for whether a subject's marks are complete. */
  today: string
}): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const c of input.classWork) {
    const label = `${c.classKey} · ${c.departmentCode} ${c.division}`

    if (c.pendingRequests > 0) {
      items.push({
        id: `enrol:${c.classId}`,
        urgency: "blocking",
        title: `${c.pendingRequests} enrolment ${plural(c.pendingRequests, "request")}`,
        detail: `${label} — a student cannot see their record until this is decided.`,
        href: `/dashboard/class/${c.classId}`,
        count: c.pendingRequests,
      })
    }

    // A class with nobody teaching a subject is why its marks and register go
    // missing later, so it outranks the symptoms.
    if (c.unallocatedSubjects > 0) {
      items.push({
        id: `unallocated:${c.classId}`,
        urgency: "blocking",
        title: `${c.unallocatedSubjects} ${plural(c.unallocatedSubjects, "subject")} with no teacher`,
        detail: `${label} — nobody can enter marks or take the register for these.`,
        href: `/dashboard/class/${c.classId}/subjects`,
        count: c.unallocatedSubjects,
      })
    }

    // Only meaningful once there is a roster to take a register against.
    if (c.students > 0 && c.markedToday === 0) {
      items.push({
        id: `attendance:${c.classId}`,
        urgency: "overdue",
        title: "Register not taken today",
        detail: `${label} — ${c.students} ${plural(c.students, "student")}, nothing recorded for ${input.today}.`,
        href: `/dashboard/class/${c.classId}/attendance`,
        count: c.students,
      })
    }

    for (const s of c.mySubjects) {
      if (c.students === 0 || s.entered >= c.students) continue
      const missing = c.students - s.entered
      items.push({
        id: `marks:${s.id}`,
        urgency: "open",
        title: `${s.code} — ${missing} ${plural(missing, "student")} unmarked`,
        detail: `${label} — ${s.entered} of ${c.students} entered for ${s.name}.`,
        href: `/dashboard/class/${c.classId}/marks?offering=${s.id}`,
        count: missing,
      })
    }
  }

  for (const d of input.deptHealth) {
    if (d.classesWithoutCoordinator > 0) {
      items.push({
        id: `coordinator:${d.code}`,
        urgency: "blocking",
        title: `${d.classesWithoutCoordinator} ${plural(d.classesWithoutCoordinator, "class", "classes")} without a coordinator`,
        detail: `${d.code} — nobody can approve enrolments or allocate subjects for these.`,
        href: `/dashboard/dept/${d.code}`,
        count: d.classesWithoutCoordinator,
      })
    }

    if (d.unallocatedSubjects > 0) {
      items.push({
        id: `dept-unallocated:${d.code}`,
        urgency: "overdue",
        title: `${d.unallocatedSubjects} unallocated ${plural(d.unallocatedSubjects, "subject")}`,
        detail: `${d.code} — waiting on a teacher to be appointed.`,
        href: "/dashboard/dept/appoint",
        count: d.unallocatedSubjects,
      })
    }

    // Not urgent, and never framed as the student's fault: an unclaimed row is
    // usually a roster typo in the email, which is the department's to fix.
    if (d.unclaimedStudents > 0) {
      items.push({
        id: `unclaimed:${d.code}`,
        urgency: "open",
        title: `${d.unclaimedStudents} ${plural(d.unclaimedStudents, "student")} ${plural(d.unclaimedStudents, "has", "have")} never signed in`,
        detail: `${d.code} — check the email on the roster row if this looks wrong.`,
        href: `/dashboard/students?department=${d.code}`,
        count: d.unclaimedStudents,
      })
    }
  }

  return items.sort(
    (a, b) => RANK[a.urgency] - RANK[b.urgency] || b.count - a.count
  )
}
