import { and, eq, ne, inArray } from "drizzle-orm"
import { db } from "@/db"
import { facultyClassAssignments, faculty } from "@/db/schema"

type ClassRole = "academic_coordinator" | "tr"

/** Put a faculty member on a class; for the one-per-class coordinator the newcomer is installed before the incumbent is retired so a failure can never leave the class unstaffed. */
export async function assignClassRole(
  classId: string,
  facultyId: string,
  role: ClassRole,
  assignedBy: string | null
) {
  if (role === "academic_coordinator") {
    const now = new Date()
    await db
      .insert(facultyClassAssignments)
      .values({ classId, facultyId, role, assignedBy, isActive: false })
      .onConflictDoUpdate({
        target: [
          facultyClassAssignments.classId,
          facultyClassAssignments.facultyId,
          facultyClassAssignments.role,
        ],
        set: { assignedBy, updatedAt: now },
      })
    await db
      .update(facultyClassAssignments)
      .set({ isActive: false, updatedAt: now })
      .where(
        and(
          eq(facultyClassAssignments.classId, classId),
          eq(facultyClassAssignments.role, role),
          eq(facultyClassAssignments.isActive, true),
          ne(facultyClassAssignments.facultyId, facultyId)
        )
      )
    await db
      .update(facultyClassAssignments)
      .set({ isActive: true, assignedBy, updatedAt: now })
      .where(
        and(
          eq(facultyClassAssignments.classId, classId),
          eq(facultyClassAssignments.facultyId, facultyId),
          eq(facultyClassAssignments.role, role)
        )
      )
    return
  }

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
