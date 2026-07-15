import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { facultyClassAssignments, faculty } from "@/db/schema"

type ClassRole = "academic_coordinator" | "tr"

/**
 * Assign a class role. The academic_coordinator is one-per-class, so the current
 * one is retired first; a tr can be added alongside. Ordered statements — no
 * transaction on neon-http, fine for an admin/HOD action.
 */
export async function assignClassRole(
  classId: string,
  facultyId: string,
  role: ClassRole,
  assignedBy: string | null
) {
  if (role === "academic_coordinator") {
    await db
      .update(facultyClassAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(facultyClassAssignments.classId, classId),
          eq(facultyClassAssignments.role, "academic_coordinator"),
          eq(facultyClassAssignments.isActive, true)
        )
      )
  }
  await db
    .insert(facultyClassAssignments)
    .values({ classId, facultyId, role, assignedBy })
}

/** Active staff across the given classes, with faculty names — for the console. */
export async function listClassStaff(classIds: string[]) {
  if (classIds.length === 0) return []
  return db
    .select({
      classId: facultyClassAssignments.classId,
      role: facultyClassAssignments.role,
      facultyId: faculty.id,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
    })
    .from(facultyClassAssignments)
    .innerJoin(faculty, eq(facultyClassAssignments.facultyId, faculty.id))
    .where(
      and(
        inArray(facultyClassAssignments.classId, classIds),
        eq(facultyClassAssignments.isActive, true)
      )
    )
}
