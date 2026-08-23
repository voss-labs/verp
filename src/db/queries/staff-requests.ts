import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm"
import { db } from "@/db"
import { staffRequests } from "@/db/schema"
import type { StaffRequestStatus } from "@/db/schema/staff-requests"

export async function createStaffRequest(input: {
  authUserId: string
  firstName: string
  lastName: string
  email: string
  employeeId: string
  deptCode: string
}) {
  const [row] = await db.insert(staffRequests).values(input).returning()
  return row
}

export async function getLatestStaffRequestForUser(authUserId: string) {
  return db.query.staffRequests.findFirst({
    where: eq(staffRequests.authUserId, authUserId),
    orderBy: desc(staffRequests.createdAt),
  })
}

export async function getStaffRequestById(id: string) {
  return db.query.staffRequests.findFirst({
    where: eq(staffRequests.id, id),
  })
}

export async function listStaffRequests(params: {
  deptCodes: string[] | null
  statuses: StaffRequestStatus[]
}) {
  if (params.deptCodes !== null && params.deptCodes.length === 0) return []
  if (params.statuses.length === 0) return []

  const conditions: SQL[] = [inArray(staffRequests.status, params.statuses)]
  if (params.deptCodes !== null) {
    conditions.push(inArray(staffRequests.deptCode, params.deptCodes))
  }

  return db
    .select()
    .from(staffRequests)
    .where(and(...conditions))
    .orderBy(staffRequests.createdAt)
}

export async function pendingStaffRequestsByDept(
  deptCodes: string[] | null
): Promise<{ deptCode: string; pending: number }[]> {
  if (deptCodes !== null && deptCodes.length === 0) return []

  const conditions: SQL[] = [eq(staffRequests.status, "pending")]
  if (deptCodes !== null) {
    conditions.push(inArray(staffRequests.deptCode, deptCodes))
  }

  return db
    .select({
      deptCode: staffRequests.deptCode,
      pending: sql<number>`count(*)::int`,
    })
    .from(staffRequests)
    .where(and(...conditions))
    .groupBy(staffRequests.deptCode)
}

export async function updateStaffRequestStatus(
  id: string,
  data: {
    status: StaffRequestStatus
    reviewedByFacultyId?: string | null
    rejectionReason?: string | null
  }
) {
  const [row] = await db
    .update(staffRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(staffRequests.id, id))
    .returning()
  return row
}

export async function deleteOwnStaffRequest(id: string, authUserId: string) {
  const [row] = await db
    .delete(staffRequests)
    .where(
      and(eq(staffRequests.id, id), eq(staffRequests.authUserId, authUserId))
    )
    .returning()
  return row
}
