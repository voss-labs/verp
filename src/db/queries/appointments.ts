import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { deptAppointments, faculty, departments } from "@/db/schema"

type Appointment = "hod" | "coordinator"

async function deactivateLive(deptCode: string, appointment: Appointment) {
  await db
    .update(deptAppointments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(deptAppointments.deptCode, deptCode),
        eq(deptAppointments.appointment, appointment),
        eq(deptAppointments.isActive, true)
      )
    )
}

/**
 * Appoint an HOD: retire the current one, record the new appointment, promote the
 * faculty's tier to hod, and update the department's denormalised pointer. Done
 * as ordered statements (neon-http has no multi-statement transaction) — safe for
 * a super-admin action.
 */
export async function appointHod(
  deptCode: string,
  facultyId: string,
  assignedBy: string | null
) {
  await deactivateLive(deptCode, "hod")
  await db
    .insert(deptAppointments)
    .values({ deptCode, facultyId, appointment: "hod", assignedBy })
  await db
    .update(faculty)
    .set({ role: "hod", updatedAt: new Date() })
    .where(eq(faculty.id, facultyId))
  await db
    .update(departments)
    .set({ hodFacultyId: facultyId, updatedAt: new Date() })
    .where(eq(departments.code, deptCode))
}

/** The department's sitting HOD, or null — the authoritative row, not the pointer. */
export async function getActiveHod(deptCode: string) {
  const [row] = await db
    .select({
      facultyId: faculty.id,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      employeeId: faculty.employeeId,
    })
    .from(deptAppointments)
    .innerJoin(faculty, eq(deptAppointments.facultyId, faculty.id))
    .where(
      and(
        eq(deptAppointments.deptCode, deptCode),
        eq(deptAppointments.appointment, "hod"),
        eq(deptAppointments.isActive, true)
      )
    )
    .limit(1)
  return row ?? null
}

/** Appoint a department coordinator. Coordinator is a scope, not a tier. */
export async function appointCoordinator(
  deptCode: string,
  facultyId: string,
  assignedBy: string | null
) {
  await deactivateLive(deptCode, "coordinator")
  await db
    .insert(deptAppointments)
    .values({ deptCode, facultyId, appointment: "coordinator", assignedBy })
}

/** Active appointments, with the appointed faculty's name — for the console. */
export async function listActiveAppointments() {
  return db
    .select({
      deptCode: deptAppointments.deptCode,
      appointment: deptAppointments.appointment,
      facultyId: faculty.id,
      firstName: faculty.firstName,
      lastName: faculty.lastName,
      email: faculty.email,
    })
    .from(deptAppointments)
    .innerJoin(faculty, eq(deptAppointments.facultyId, faculty.id))
    .where(eq(deptAppointments.isActive, true))
}
