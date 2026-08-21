import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm"
import { db } from "@/db"
import { classes, courseOfferings, courses, marks, students } from "@/db/schema"
import { getAttendanceBySubject } from "./attendance"

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

export type StudentProfileSubject = {
  offeringId: string
  semester: number
  code: string
  name: string
  courseType: string
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
  published: boolean
}

export type StudentProfileClass = {
  id: string
  classKey: string
  admissionYear: number
  departmentCode: string
  division: string
}

export type StudentProfile = {
  class: StudentProfileClass | null
  subjects: StudentProfileSubject[]
  attendance: Awaited<ReturnType<typeof getAttendanceBySubject>>
}

export async function getStudentProfile(student: {
  id: string
  classKey: string | null
}): Promise<StudentProfile> {
  const [cls, rows, attendance] = await Promise.all([
    student.classKey
      ? db.query.classes.findFirst({
          where: eq(classes.classKey, student.classKey),
          columns: {
            id: true,
            classKey: true,
            admissionYear: true,
            departmentCode: true,
            division: true,
          },
        })
      : undefined,
    db
      .select({
        offeringId: courseOfferings.id,
        semester: courseOfferings.semester,
        publishedAt: courseOfferings.publishedAt,
        code: courses.courseCode,
        name: courses.courseName,
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
      .innerJoin(
        courseOfferings,
        eq(marks.courseOfferingId, courseOfferings.id)
      )
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .where(eq(marks.studentId, student.id)),
    getAttendanceBySubject(student.id),
  ])

  const subjects = rows
    .map(({ publishedAt, ...r }) => ({ ...r, published: publishedAt != null }))
    .sort((a, b) => a.semester - b.semester || a.code.localeCompare(b.code))

  return { class: cls ?? null, subjects, attendance }
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

/**
 * Mark a whole cohort as graduated. Keyed by class_key rather than a list of
 * ids: graduation happens to a cohort, and naming the cohort is what makes the
 * action idempotent — re-running it cannot catch a student who transferred in
 * afterwards by accident.
 *
 * isActive is left alone. A graduated student is not deactivated: their marks
 * and attendance still have to be readable, and deactivation is the tool for
 * "this row should not have existed", which is a different statement.
 */
export async function graduateClassKey(classKey: string, on: Date) {
  const rows = await db
    .update(students)
    .set({ graduatedAt: on, updatedAt: new Date() })
    .where(and(eq(students.classKey, classKey), isNull(students.graduatedAt)))
    .returning({ id: students.id })
  return rows.length
}

/** Undo a graduation marked in error. */
export async function ungraduateClassKey(classKey: string) {
  const rows = await db
    .update(students)
    .set({ graduatedAt: null, updatedAt: new Date() })
    .where(eq(students.classKey, classKey))
    .returning({ id: students.id })
  return rows.length
}

/**
 * Cohorts with at least one graduated student. Graduation is recorded per
 * student because that is where it is true — but the dept page asks the
 * cohort-level question, so it is answered with one distinct read rather than
 * loading every roster to find out.
 */
export async function getGraduatedClassKeys(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ classKey: students.classKey })
    .from(students)
    .where(isNotNull(students.graduatedAt))
  return new Set(rows.map((r) => r.classKey).filter((k): k is string => !!k))
}
