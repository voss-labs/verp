import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { marks, marksLocks, courseOfferings, courses } from "@/db/schema"

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

export type MarksLock = {
  component: LockComponent
  /** Who froze it. Null for a lock recorded before this was tracked. */
  lockedByFacultyId: string | null
}

/**
 * Locked components for one offering, with who locked each. Absent row = never
 * locked = open.
 *
 * The owner is returned, not just the component name, because reopening is
 * allowed to the person who submitted as well as to the coordinator — undoing
 * your own submission is a correction, not an override.
 */
export async function getLockedComponents(
  courseOfferingId: string
): Promise<MarksLock[]> {
  const rows = await db
    .select({
      component: marksLocks.component,
      isLocked: marksLocks.isLocked,
      lockedByFacultyId: marksLocks.lockedByFacultyId,
    })
    .from(marksLocks)
    .where(eq(marksLocks.courseOfferingId, courseOfferingId))
  return rows
    .filter((r) => r.isLocked && isLockComponent(r.component))
    .map((r) => ({
      component: r.component as LockComponent,
      lockedByFacultyId: r.lockedByFacultyId,
    }))
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

/**
 * Every mark recorded for a class, across all its subjects and semesters, with
 * the student and course detail the results console needs. One read: the class
 * has few enough offerings that per-student queries would only add round trips.
 */
export async function getMarksForClass(classId: string) {
  return db
    .select({
      studentId: marks.studentId,
      semester: courseOfferings.semester,
      courseCode: courses.courseCode,
      courseName: courses.courseName,
      courseType: courses.courseType,
      credits: courses.credits,
      maxIsa: courses.maxIsa,
      maxMse: courses.maxMse,
      maxEse: courses.maxEse,
      maxTotal: courses.maxTotal,
      isa: marks.isa,
      mse1: marks.mse1,
      mse2: marks.mse2,
      ese: marks.ese,
    })
    .from(marks)
    .innerJoin(courseOfferings, eq(marks.courseOfferingId, courseOfferings.id))
    .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
    .where(eq(courseOfferings.classId, classId))
}
