import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { attendance, courseOfferings, courses } from "@/db/schema"

type Entry = {
  studentId: string
  classId: string
  sessionDate: string
  sessionSlot: string
  status: "present" | "absent" | "late" | "excused"
  recordedByFacultyId: string | null
}

// One row per (student, date, slot); re-recording a session overwrites it.
export async function upsertAttendance(entries: Entry[]) {
  if (entries.length === 0) return
  await db
    .insert(attendance)
    .values(entries)
    .onConflictDoUpdate({
      target: [
        attendance.studentId,
        attendance.sessionDate,
        attendance.sessionSlot,
      ],
      set: {
        status: sql`excluded.status`,
        recordedByFacultyId: sql`excluded.recorded_by_faculty_id`,
        updatedAt: new Date(),
      },
    })
}

export async function getAttendanceForSession(
  classId: string,
  sessionDate: string,
  sessionSlot: string
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
        eq(attendance.sessionSlot, sessionSlot)
      )
    )
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
 */
export async function getAttendanceBySubject(studentId: string) {
  const rows = await db
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
    .where(eq(attendance.studentId, studentId))

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
      percent: v.total > 0 ? Math.round((v.present / v.total) * 100) : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}
