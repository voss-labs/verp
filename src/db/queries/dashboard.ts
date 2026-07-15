import { sql } from "drizzle-orm"
import { db } from "@/db"

export async function getDashboardStats() {
  const result = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM students WHERE is_active = true) as total_students,
      (SELECT count(*)::int FROM faculty WHERE is_active = true) as total_faculty,
      (SELECT count(*)::int FROM courses WHERE is_active = true) as total_courses,
      (SELECT count(*)::int FROM departments WHERE is_active = true) as total_departments
  `)
  return result.rows[0] as {
    total_students: number
    total_faculty: number
    total_courses: number
    total_departments: number
  }
}
