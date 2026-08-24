import { and, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  attendance,
  batchAssignments,
  batches,
  courseOfferings,
  courses,
} from "@/db/schema"

type Entry = {
  studentId: string
  classId: string
  courseOfferingId: string | null
  batchId: string | null
  sessionDate: string
  sessionSlot: string
  status: "present" | "absent" | "late" | "excused"
  recordedByFacultyId: string | null
}

const overwrite = {
  status: sql`excluded.status`,
  recordedByFacultyId: sql`excluded.recorded_by_faculty_id`,
  batchId: sql`excluded.batch_id`,
  updatedAt: new Date(),
}

/**
 * One row per (student, date, slot, subject); re-recording a session overwrites
 * it, because a teacher correcting a mistake is the common case.
 *
 * Two partial unique indexes back that identity — one for subject registers,
 * one for class-level ones — so the insert has to name the matching index for
 * Postgres to resolve a conflict against it. Naming the wrong one does not fall
 * back to an update: it raises a duplicate-key error on the second save.
 */
export async function upsertAttendance(entries: Entry[]) {
  const subject = entries.filter((e) => e.courseOfferingId !== null)
  const classLevel = entries.filter((e) => e.courseOfferingId === null)

  if (subject.length > 0) {
    await db
      .insert(attendance)
      .values(subject)
      .onConflictDoUpdate({
        target: [
          attendance.studentId,
          attendance.sessionDate,
          attendance.sessionSlot,
          attendance.courseOfferingId,
        ],
        targetWhere: sql`course_offering_id IS NOT NULL`,
        set: overwrite,
      })
  }

  if (classLevel.length > 0) {
    await db
      .insert(attendance)
      .values(classLevel)
      .onConflictDoUpdate({
        target: [
          attendance.studentId,
          attendance.sessionDate,
          attendance.sessionSlot,
        ],
        targetWhere: sql`course_offering_id IS NULL`,
        set: overwrite,
      })
  }
}

export async function getAttendanceForSession(
  classId: string,
  sessionDate: string,
  sessionSlot: string,
  courseOfferingId: string | null,
  batchId: string | null = null
) {
  return db
    .select({
      studentId: attendance.studentId,
      status: attendance.status,
    })
    .from(attendance)
    .where(
      and(
        eq(attendance.classId, classId),
        eq(attendance.sessionDate, sessionDate),
        eq(attendance.sessionSlot, sessionSlot),
        // A subject's register and the class-level one are different sessions
        // on the same day; reading them together would show one as the other.
        courseOfferingId
          ? eq(attendance.courseOfferingId, courseOfferingId)
          : isNull(attendance.courseOfferingId),
        batchId ? eq(attendance.batchId, batchId) : isNull(attendance.batchId)
      )
    )
}

export async function hasUntaggedAttendance(
  classId: string,
  courseOfferingId: string
) {
  const [row] = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(
      and(
        eq(attendance.classId, classId),
        eq(attendance.courseOfferingId, courseOfferingId),
        isNull(attendance.batchId)
      )
    )
    .limit(1)
  return !!row
}

// A student's overall attendance — present sessions over total recorded.
export async function getAttendanceSummaryForStudent(studentId: string) {
  const [row] = await db
    .select({
      present: sql<number>`count(*) filter (where status = 'present')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(attendance)
    .where(eq(attendance.studentId, studentId))
  return { present: row?.present ?? 0, total: row?.total ?? 0 }
}

/**
 * A student's attendance broken down by subject, plus the sessions that were
 * taken for the class as a whole.
 *
 * The schema always allowed a subject-wise mark — courseOfferingId has been
 * nullable on the row since attendance was introduced — but the register only
 * ever wrote the class-level form, so a student could see one overall figure and
 * never which subject they were short in. VIT's 75% rule is enforced per
 * subject, so an overall number cannot answer the question anybody actually
 * asks.
 *
 * Lab batches need no filter here: a batch register only ever writes rows for
 * the students sitting in that batch, so both counts are already confined to
 * the sessions this student's batch actually had.
 */
export async function getAttendanceBySubject(studentId: string) {
  const [rows, memberships] = await Promise.all([
    db
      .select({
        offeringId: attendance.courseOfferingId,
        code: courses.courseCode,
        name: courses.courseName,
        status: attendance.status,
      })
      .from(attendance)
      .leftJoin(
        courseOfferings,
        eq(attendance.courseOfferingId, courseOfferings.id)
      )
      .leftJoin(courses, eq(courseOfferings.courseId, courses.id))
      .where(eq(attendance.studentId, studentId)),
    db
      .select({
        offeringId: batches.courseOfferingId,
        name: batches.name,
      })
      .from(batchAssignments)
      .innerJoin(batches, eq(batchAssignments.batchId, batches.id))
      .where(
        and(
          eq(batchAssignments.studentId, studentId),
          eq(batchAssignments.isActive, true),
          eq(batches.isActive, true)
        )
      ),
  ])

  const batchByOffering = new Map(
    memberships.map((m) => [m.offeringId, m.name])
  )

  const bucket = new Map<
    string,
    { code: string; name: string; present: number; total: number }
  >()
  for (const r of rows) {
    // A session with no offering was taken for the class rather than a subject;
    // it is reported separately instead of being spread across subjects it was
    // never attached to.
    const key = r.offeringId ?? "__class"
    const cur = bucket.get(key) ?? {
      code: r.code ?? "—",
      name: r.name ?? "Class sessions",
      present: 0,
      total: 0,
    }
    cur.total += 1
    if (r.status === "present" || r.status === "late") cur.present += 1
    bucket.set(key, cur)
  }

  return [...bucket.entries()]
    .map(([key, v]) => ({
      ...v,
      offeringId: key === "__class" ? null : key,
      batch: key === "__class" ? null : (batchByOffering.get(key) ?? null),
      percent: v.total > 0 ? Math.round((v.present / v.total) * 100) : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}
