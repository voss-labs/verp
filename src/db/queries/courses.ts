import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { courses } from "@/db/schema"

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
