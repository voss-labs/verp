import { and, count, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { courses, courseOfferings } from "@/db/schema"

export async function getCourseByCode(code: string) {
  return db.query.courses.findFirst({
    where: eq(courses.courseCode, code.toUpperCase()),
  })
}

export async function listCoursesForDepts(deptCodes: string[]) {
  if (deptCodes.length === 0) return []
  return db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.isActive, true),
        inArray(courses.departmentCode, deptCodes)
      )
    )
    .orderBy(courses.courseCode)
}

export async function createCourse(input: {
  courseCode: string
  courseName: string
  departmentCode: string
  courseType: "theory" | "practical" | "project"
  year?: string | null
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
}) {
  const [row] = await db
    .insert(courses)
    .values({ ...input, courseCode: input.courseCode.toUpperCase() })
    .returning()
  return row
}

export async function getCourseById(id: string) {
  return db.query.courses.findFirst({ where: eq(courses.id, id) })
}

export async function updateCourse(
  id: string,
  input: {
    courseName: string
    courseType: "theory" | "practical" | "project"
    year?: string | null
    credits: number
    maxIsa: number
    maxMse: number
    maxEse: number
    maxTotal: number
  }
) {
  const [row] = await db
    .update(courses)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning()
  return row
}

/**
 * Soft-delete only. A course that has been taught is referenced by offerings and
 * through them by marks, so removing the row would orphan somebody's result.
 * Deactivating keeps the history and just stops it being offered again.
 */
export async function setCourseActive(id: string, isActive: boolean) {
  const [row] = await db
    .update(courses)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning()
  return row
}

/** How many offerings reference each course — a course in use cannot be edited
 *  down to fewer marks than already recorded against it. */
export async function countOfferingsByCourse(courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, number>()
  const rows = await db
    .select({ courseId: courseOfferings.courseId, n: count() })
    .from(courseOfferings)
    .where(inArray(courseOfferings.courseId, courseIds))
    .groupBy(courseOfferings.courseId)
  return new Map(rows.map((r) => [r.courseId, Number(r.n)]))
}
