import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { marks, marksLocks } from "@/db/schema"

type Entry = {
  courseOfferingId: string
  studentId: string
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
  recordedByFacultyId: string | null
}

// One row per (offering, student); re-entering overwrites.
export async function upsertMarks(entries: Entry[]) {
  if (entries.length === 0) return
  await db
    .insert(marks)
    .values(entries)
    .onConflictDoUpdate({
      target: [marks.courseOfferingId, marks.studentId],
      set: {
        isa: sql`excluded.isa`,
        mse1: sql`excluded.mse1`,
        mse2: sql`excluded.mse2`,
        ese: sql`excluded.ese`,
        recordedByFacultyId: sql`excluded.recorded_by_faculty_id`,
        updatedAt: new Date(),
      },
    })
}

export async function getMarksForOffering(courseOfferingId: string) {
  return db
    .select({
      studentId: marks.studentId,
      isa: marks.isa,
      mse1: marks.mse1,
      mse2: marks.mse2,
      ese: marks.ese,
    })
    .from(marks)
    .where(eq(marks.courseOfferingId, courseOfferingId))
}

// A student's marks across every subject, with the course details needed to
// compute grade points and SGPI.
export async function getMarksForStudent(studentId: string) {
  return db.query.marks.findMany({
    where: eq(marks.studentId, studentId),
    with: { courseOffering: { with: { course: true } } },
  })
}

// ── locks ──────────────────────────────────────────────────────────────────
//
// A component is frozen once its marks are submitted upstream: ISA when
// internals go in, MSE after mid-sems, ESE at the end of term. They are locked
// separately because they are finished at different points — freezing the whole
// subject the moment ISA is done would block the ESE column for the rest of the
// semester.
//
// `mse` covers both mse1 and mse2: they are two halves of one component that is
// averaged into a single mark, so they are never submitted apart.

export const LOCKABLE_COMPONENTS = ["isa", "mse", "ese"] as const
export type LockComponent = (typeof LOCKABLE_COMPONENTS)[number]

export function isLockComponent(v: string): v is LockComponent {
  return (LOCKABLE_COMPONENTS as readonly string[]).includes(v)
}

/** Locked components for one offering. Absent row = never locked = open. */
export async function getLockedComponents(
  courseOfferingId: string
): Promise<LockComponent[]> {
  const rows = await db
    .select({ component: marksLocks.component, isLocked: marksLocks.isLocked })
    .from(marksLocks)
    .where(eq(marksLocks.courseOfferingId, courseOfferingId))
  return rows
    .filter((r) => r.isLocked && isLockComponent(r.component))
    .map((r) => r.component as LockComponent)
}

/**
 * Freeze or reopen one component. Upserts on the (offering, component) unique
 * index so re-locking is idempotent. Unlocking keeps the row and clears the
 * stamp rather than deleting it — who reopened what is recorded in audit_logs,
 * which is where every other mutation in the app already leaves its trail.
 */
export async function setMarksLock(input: {
  courseOfferingId: string
  component: LockComponent
  locked: boolean
  facultyId: string | null
}) {
  const stamp = input.locked
    ? { lockedByFacultyId: input.facultyId, lockedAt: new Date() }
    : { lockedByFacultyId: null, lockedAt: null }
  const [row] = await db
    .insert(marksLocks)
    .values({
      courseOfferingId: input.courseOfferingId,
      component: input.component,
      isLocked: input.locked,
      ...stamp,
    })
    .onConflictDoUpdate({
      target: [marksLocks.courseOfferingId, marksLocks.component],
      set: { isLocked: input.locked, ...stamp, updatedAt: new Date() },
    })
    .returning()
  return row
}
