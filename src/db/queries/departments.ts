import { eq } from "drizzle-orm"
import { db } from "@/db"
import { departments } from "@/db/schema"

export async function getAllDepartments() {
  return db.query.departments.findMany({
    where: eq(departments.isActive, true),
    orderBy: (departments, { asc }) => [asc(departments.name)],
  })
}

export async function getDepartmentById(id: number) {
  return db.query.departments.findFirst({
    where: eq(departments.id, id),
    with: { courses: true },
  })
}

export async function createDepartment(data: typeof departments.$inferInsert) {
  const [result] = await db.insert(departments).values(data).returning()
  return result
}

export async function updateDepartment(
  id: number,
  data: Partial<typeof departments.$inferInsert>
) {
  const [result] = await db
    .update(departments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(departments.id, id))
    .returning()
  return result
}
