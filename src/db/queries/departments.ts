import { desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { departments } from "@/db/schema"

export async function listDepartments() {
  return db
    .select()
    .from(departments)
    .orderBy(desc(departments.isActive), departments.code)
}

export async function getDepartment(code: string) {
  return db.query.departments.findFirst({
    where: eq(departments.code, code),
  })
}

export async function createDepartment(input: { code: string; name: string }) {
  const [row] = await db
    .insert(departments)
    .values({ code: input.code.toUpperCase().trim(), name: input.name.trim() })
    .returning()
  return row
}

export async function setDepartmentActive(code: string, isActive: boolean) {
  const [row] = await db
    .update(departments)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(departments.code, code))
    .returning()
  return row
}
