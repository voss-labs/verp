import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { students } from "@/db/schema"

export async function getStudentById(id: string) {
  return db.query.students.findFirst({
    where: and(eq(students.id, id), eq(students.isActive, true)),
  })
}

export async function getStudentByAuthUserId(authUserId: string) {
  return db.query.students.findFirst({
    where: and(
      eq(students.authUserId, authUserId),
      eq(students.isActive, true)
    ),
  })
}

export async function getStudentByRollNumber(rollNumber: string) {
  return db.query.students.findFirst({
    where: eq(students.rollNumber, rollNumber.toUpperCase()),
  })
}

export async function getStudentByEmail(email: string) {
  return db.query.students.findFirst({
    where: and(
      eq(students.email, email.toLowerCase()),
      eq(students.isActive, true)
    ),
  })
}

export async function linkStudentToAuthUser(
  studentId: string,
  authUserId: string
) {
  const [row] = await db
    .update(students)
    .set({ authUserId })
    .where(eq(students.id, studentId))
    .returning()
  return row
}

export async function getAllStudents(filters?: {
  department?: string
  year?: string
}) {
  return db.query.students.findMany({
    where: and(
      eq(students.isActive, true),
      filters?.department
        ? eq(students.department, filters.department)
        : undefined,
      filters?.year ? eq(students.year, filters.year) : undefined
    ),
    orderBy: (students, { asc }) => [
      asc(students.lastName),
      asc(students.firstName),
    ],
  })
}

export async function createStudent(data: typeof students.$inferInsert) {
  const [result] = await db.insert(students).values(data).returning()
  return result
}

export async function updateStudent(
  id: string,
  data: Partial<typeof students.$inferInsert>
) {
  const [result] = await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(students.id, id))
    .returning()
  return result
}

export async function deactivateStudent(id: string) {
  return updateStudent(id, { isActive: false })
}
