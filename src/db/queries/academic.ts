import { eq } from "drizzle-orm"
import { db } from "@/db"
import { academicYears, semesters } from "@/db/schema"

export async function getCurrentSemester() {
  return db.query.semesters.findFirst({
    where: eq(semesters.isCurrent, true),
    with: { academicYear: true },
  })
}

export async function getAllSemesters() {
  return db.query.semesters.findMany({
    where: eq(semesters.isActive, true),
    with: { academicYear: true },
    orderBy: (s, { desc }) => [desc(s.id)],
  })
}

export async function getAllAcademicYears() {
  return db.query.academicYears.findMany({
    where: eq(academicYears.isActive, true),
    orderBy: (ay, { desc }) => [desc(ay.startDate)],
  })
}
