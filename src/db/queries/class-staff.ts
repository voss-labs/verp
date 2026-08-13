import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { facultyClassAssignments, faculty } from "@/db/schema"

type ClassRole = "academic_coordinator" | "tr"

/**
 * Assign a class role. Both roles are one-per-class — coordinator and TR alike —
 * so the current holder of that role is retired before the new one is written.
 * Ordered statements — no transaction on neon-http, fine for an admin/HOD action.
 */
/**
 * Put a faculty member on a class.
 *
 * The coordinator is one per class and replacing them retires the incumbent —
 * the database enforces that with a partial unique index, so the retirement has
 * to happen first or the insert fails.
 *
 * TRs accumulate. A class is taught by as many teachers as it has subjects, and
 * each subject carries its own teacher, so retiring the previous TR on every
 * appointment silently unstaffed whoever was already there. That rule was
 * written before subjects were allocated per teacher; the schema never asked
 * for it, and only the coordinator index does.
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
          eq(facultyClassAssignments.role, role),
          eq(facultyClassAssignments.isActive, true)
        )
      )
  }

  // Re-appointing someone already on the class reactivates their row rather
  // than adding a second: the pair is unique, and a duplicate would show them
  // twice on every roster.
  await db
    .insert(facultyClassAssignments)
    .values({ classId, facultyId, role, assignedBy })
    .onConflictDoUpdate({
      target: [
        facultyClassAssignments.classId,
        facultyClassAssignments.facultyId,
        facultyClassAssignments.role,
      ],
      set: { isActive: true, assignedBy, updatedAt: new Date() },
    })
}

/** Take a faculty member off a class. Soft, so the history survives. */
export async function removeClassRole(
  classId: string,
  facultyId: string,
  role: ClassRole
) {
  await db
    .update(facultyClassAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(facultyClassAssignments.classId, classId),
        eq(facultyClassAssignments.facultyId, facultyId),
        eq(facultyClassAssignments.role, role)
      )
    )
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
