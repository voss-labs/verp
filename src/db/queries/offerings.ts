import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import {
  courseOfferings,
  studentEnrollments,
  batches,
  batchAssignments,
} from "@/db/schema"

export async function getAllCourseOfferings(semesterId?: number) {
  return db.query.courseOfferings.findMany({
    where: and(
      eq(courseOfferings.isActive, true),
      semesterId ? eq(courseOfferings.semesterId, semesterId) : undefined
    ),
    with: {
      course: true,
      faculty: true,
      semester: { with: { academicYear: true } },
    },
    orderBy: (co, { asc }) => [asc(co.division)],
  })
}

export async function getCourseOfferingById(id: string) {
  return db.query.courseOfferings.findFirst({
    where: and(eq(courseOfferings.id, id), eq(courseOfferings.isActive, true)),
    with: {
      course: true,
      faculty: true,
      semester: { with: { academicYear: true } },
      batches: true,
      enrollments: { with: { student: true } },
    },
  })
}

export async function getCourseOfferingsByFaculty(
  facultyId: string,
  semesterId?: number
) {
  return db.query.courseOfferings.findMany({
    where: and(
      eq(courseOfferings.facultyId, facultyId),
      eq(courseOfferings.isActive, true),
      semesterId ? eq(courseOfferings.semesterId, semesterId) : undefined
    ),
    with: {
      course: true,
      faculty: true,
      semester: { with: { academicYear: true } },
      batches: true,
    },
    orderBy: (co, { asc }) => [asc(co.division)],
  })
}

export async function createCourseOffering(
  data: typeof courseOfferings.$inferInsert
) {
  const [result] = await db.insert(courseOfferings).values(data).returning()
  return result
}

export async function updateCourseOffering(
  id: string,
  data: Partial<typeof courseOfferings.$inferInsert>
) {
  const [result] = await db
    .update(courseOfferings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(courseOfferings.id, id))
    .returning()
  return result
}

export async function getEnrollmentsByCourseOffering(courseOfferingId: string) {
  return db.query.studentEnrollments.findMany({
    where: and(
      eq(studentEnrollments.courseOfferingId, courseOfferingId),
      eq(studentEnrollments.isActive, true)
    ),
    with: { student: true },
  })
}

export async function enrollStudent(
  data: typeof studentEnrollments.$inferInsert
) {
  const [result] = await db
    .insert(studentEnrollments)
    .values(data)
    .onConflictDoUpdate({
      target: [
        studentEnrollments.courseOfferingId,
        studentEnrollments.studentId,
      ],
      set: { isActive: true, updatedAt: new Date() },
    })
    .returning()
  return result
}

export async function getBatchesByCourseOffering(courseOfferingId: string) {
  return db.query.batches.findMany({
    where: and(
      eq(batches.courseOfferingId, courseOfferingId),
      eq(batches.isActive, true)
    ),
    with: { assignments: { with: { student: true } } },
  })
}

export async function createBatch(data: typeof batches.$inferInsert) {
  const [result] = await db.insert(batches).values(data).returning()
  return result
}

export async function unenrollStudent(
  courseOfferingId: string,
  studentId: string
) {
  const [result] = await db
    .update(studentEnrollments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(studentEnrollments.courseOfferingId, courseOfferingId),
        eq(studentEnrollments.studentId, studentId)
      )
    )
    .returning()
  return result
}

export async function assignStudentToBatch(
  data: typeof batchAssignments.$inferInsert
) {
  const [result] = await db
    .insert(batchAssignments)
    .values(data)
    .onConflictDoUpdate({
      target: [batchAssignments.batchId, batchAssignments.studentId],
      set: { isActive: true, updatedAt: new Date() },
    })
    .returning()
  return result
}
