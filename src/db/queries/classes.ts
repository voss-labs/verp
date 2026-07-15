import { and, eq, inArray, desc } from "drizzle-orm"
import { db } from "@/db"
import { classes, enrollmentRequests } from "@/db/schema"

export async function getClassByKey(classKey: string) {
  return db.query.classes.findFirst({ where: eq(classes.classKey, classKey) })
}

export async function getClassById(id: string) {
  return db.query.classes.findFirst({ where: eq(classes.id, id) })
}

export async function createClass(input: {
  classKey: string
  admissionYear: number
  branchCode: string
  departmentCode: string
  division: string
}) {
  const [row] = await db.insert(classes).values(input).returning()
  return row
}

export async function listClassesForDepts(deptCodes: string[]) {
  if (deptCodes.length === 0) return []
  return db
    .select()
    .from(classes)
    .where(inArray(classes.departmentCode, deptCodes))
    .orderBy(
      desc(classes.isActive),
      desc(classes.admissionYear),
      classes.branchCode,
      classes.division
    )
}

export async function setClassActive(id: string, isActive: boolean) {
  const [row] = await db
    .update(classes)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(classes.id, id))
    .returning()
  return row
}

/** Unrouted self-registration requests — no class existed for the roll yet. */
export async function listUnroutedRequests() {
  return db
    .select({
      id: enrollmentRequests.id,
      rollNumber: enrollmentRequests.rollNumber,
      firstName: enrollmentRequests.firstName,
      lastName: enrollmentRequests.lastName,
      email: enrollmentRequests.email,
    })
    .from(enrollmentRequests)
    .where(eq(enrollmentRequests.status, "unrouted"))
}

/** Attach the given unrouted requests to a now-existing class and re-queue them. */
export async function routeRequestsToClass(
  requestIds: string[],
  classId: string
) {
  if (requestIds.length === 0) return
  await db
    .update(enrollmentRequests)
    .set({ classId, status: "pending", updatedAt: new Date() })
    .where(
      and(
        inArray(enrollmentRequests.id, requestIds),
        eq(enrollmentRequests.status, "unrouted")
      )
    )
}
