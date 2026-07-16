import { eq, and, inArray } from "drizzle-orm"
import { db } from "@/db"
import { students } from "@/db/schema"

// Coordinator scope: the students of a class are exactly those whose roll-derived
// class_key matches the class — no stored link to populate or drift.
export async function getStudentsByClassKeys(classKeys: string[]) {
  if (classKeys.length === 0) return []
  return db.query.students.findMany({
    where: and(
      eq(students.isActive, true),
      inArray(students.classKey, classKeys)
    ),
    orderBy: (s, { asc }) => [asc(s.rollNumber)],
  })
}

// HOD scope: every student in their department(s).
export async function getStudentsByDepartments(departments: string[]) {
  if (departments.length === 0) return []
  return db.query.students.findMany({
    where: and(
      eq(students.isActive, true),
      inArray(students.department, departments)
    ),
    orderBy: (s, { asc }) => [asc(s.rollNumber)],
  })
}

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

export async function deactivateStudentsByIds(ids: string[]) {
  if (ids.length === 0) return 0
  const rows = await db
    .update(students)
    .set({ isActive: false, updatedAt: new Date() })
    .where(inArray(students.id, ids))
    .returning({ id: students.id })
  return rows.length
}
