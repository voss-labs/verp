import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { courses } from "@/db/schema"

export async function getCourseById(id: string) {
  return db.query.courses.findFirst({
    where: and(eq(courses.id, id), eq(courses.isActive, true)),
    with: { department: true },
  })
}

export async function getAllCourses(filters?: {
  departmentId?: number
  courseType?: string
}) {
  return db.query.courses.findMany({
    where: and(
      eq(courses.isActive, true),
      filters?.departmentId
        ? eq(courses.departmentId, filters.departmentId)
        : undefined,
      filters?.courseType
        ? eq(courses.courseType, filters.courseType)
        : undefined
    ),
    with: { department: true },
    orderBy: (courses, { asc }) => [asc(courses.courseCode)],
  })
}

export async function createCourse(data: typeof courses.$inferInsert) {
  const [result] = await db.insert(courses).values(data).returning()
  return result
}

export async function updateCourse(
  id: string,
  data: Partial<typeof courses.$inferInsert>
) {
  const [result] = await db
    .update(courses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(courses.id, id))
    .returning()
  return result
}

export async function deactivateCourse(id: string) {
  return updateCourse(id, { isActive: false })
}
