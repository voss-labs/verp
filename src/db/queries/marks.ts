import { eq, sql } from "drizzle-orm"
import { db } from "@/db"
import { marks } from "@/db/schema"

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
