import { eq, and, inArray, or, sql } from "drizzle-orm"
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

export async function getStudentsByYearSemester(params: {
  year: string
  semester: string
}) {
  const yearValue = params.year.trim()
  const semesterValue = params.semester.trim()
  const semesterVariants = [semesterValue, `Sem ${semesterValue}`]
  return db.query.students.findMany({
    where: and(
      eq(students.isActive, true),
      or(
        eq(students.year, yearValue),
        sql`trim(${students.year}) = ${yearValue}`
      ),
      or(
        eq(students.semester, semesterVariants[0]),
        eq(students.semester, semesterVariants[1]),
        sql`trim(${students.semester}) = ${semesterVariants[0]}`,
        sql`trim(${students.semester}) = ${semesterVariants[1]}`
      )
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

export async function bulkPromoteStudents(params: {
  studentIds: string[]
  sourceYear: string
  sourceSemester: string
  targetYear: string
  targetSemester: string
}) {
  if (params.studentIds.length === 0) return []

  const yearValue = params.sourceYear.trim()
  const semesterValue = params.sourceSemester.trim()
  const semesterVariants = [semesterValue, `Sem ${semesterValue}`]

  const result = await db
    .update(students)
    .set({
      year: params.targetYear,
      semester: params.targetSemester,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(students.isActive, true),
        or(
          eq(students.year, yearValue),
          sql`trim(${students.year}) = ${yearValue}`
        ),
        or(
          eq(students.semester, semesterVariants[0]),
          eq(students.semester, semesterVariants[1]),
          sql`trim(${students.semester}) = ${semesterVariants[0]}`,
          sql`trim(${students.semester}) = ${semesterVariants[1]}`
        ),
        inArray(students.id, params.studentIds)
      )
    )
    .returning()

  return result
}

export async function bulkGraduateStudents(params: {
  studentIds: string[]
  sourceYear: string
  sourceSemester: string
  graduatedAt?: Date
}) {
  if (params.studentIds.length === 0) return []

  const yearValue = params.sourceYear.trim()
  const semesterValue = params.sourceSemester.trim()
  const semesterVariants = [semesterValue, `Sem ${semesterValue}`]

  const result = await db
    .update(students)
    .set({
      isActive: false,
      graduatedAt: params.graduatedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(students.isActive, true),
        or(
          eq(students.year, yearValue),
          sql`trim(${students.year}) = ${yearValue}`
        ),
        or(
          eq(students.semester, semesterVariants[0]),
          eq(students.semester, semesterVariants[1]),
          sql`trim(${students.semester}) = ${semesterVariants[0]}`,
          sql`trim(${students.semester}) = ${semesterVariants[1]}`
        ),
        inArray(students.id, params.studentIds)
      )
    )
    .returning()

  return result
}

export async function getStudentCount() {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(students)
    .where(eq(students.isActive, true))
  return result.count
}
