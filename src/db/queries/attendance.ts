import { and, eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { attendance } from "@/db/schema"

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
