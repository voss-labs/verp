import { eq, and, sql } from "drizzle-orm"
import { db } from "@/db"
import { faculty } from "@/db/schema"

export async function getFacultyById(id: string) {
  return db.query.faculty.findFirst({
    where: and(eq(faculty.id, id), eq(faculty.isActive, true)),
  })
}

export async function getFacultyByAuthUserId(authUserId: string) {
  return db.query.faculty.findFirst({
    where: and(eq(faculty.authUserId, authUserId), eq(faculty.isActive, true)),
  })
}

export async function getFacultyByEmail(email: string) {
  return db.query.faculty.findFirst({
    where: and(
      eq(faculty.email, email.toLowerCase()),
      eq(faculty.isActive, true)
    ),
  })
}

export async function linkFacultyToAuthUser(
  facultyId: string,
  authUserId: string
) {
  const [row] = await db
    .update(faculty)
    .set({ authUserId })
    .where(eq(faculty.id, facultyId))
    .returning()
  return row
}

export async function getAllFaculty(filters?: { department?: string }) {
  return db.query.faculty.findMany({
    where: and(
      eq(faculty.isActive, true),
      filters?.department
        ? eq(faculty.department, filters.department)
        : undefined
    ),
    orderBy: (faculty, { asc }) => [
      asc(faculty.lastName),
      asc(faculty.firstName),
    ],
  })
}

export async function createFaculty(data: typeof faculty.$inferInsert) {
  const [result] = await db.insert(faculty).values(data).returning()
  return result
}

export async function updateFaculty(
  id: string,
  data: Partial<typeof faculty.$inferInsert>
) {
  const [result] = await db
    .update(faculty)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(faculty.id, id))
    .returning()
  return result
}

export async function deactivateFaculty(id: string) {
  return updateFaculty(id, { isActive: false })
}

export async function getFacultyCount() {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(faculty)
    .where(eq(faculty.isActive, true))
  return result.count
}
