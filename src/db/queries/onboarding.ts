import { and, desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { enrollmentRequests, classes } from "@/db/schema"

/** The user's most recent enrolment request, whatever its state. */
export async function getLatestRequestForUser(authUserId: string) {
  return db.query.enrollmentRequests.findFirst({
    where: eq(enrollmentRequests.authUserId, authUserId),
    orderBy: desc(enrollmentRequests.createdAt),
  })
}

export async function getRequestById(id: string) {
  return db.query.enrollmentRequests.findFirst({
    where: eq(enrollmentRequests.id, id),
  })
}

export async function createEnrollmentRequest(input: {
  authUserId: string
  rollNumber: string
  firstName: string
  lastName: string
  email: string
  classId: string | null
  status: "pending" | "unrouted"
}) {
  const [row] = await db.insert(enrollmentRequests).values(input).returning()
  return row
}

/** The coordinator's queue: pending requests for one class, oldest first. */
export async function listPendingRequestsForClass(classId: string) {
  return db
    .select()
    .from(enrollmentRequests)
    .where(
      and(
        eq(enrollmentRequests.classId, classId),
        eq(enrollmentRequests.status, "pending")
      )
    )
    .orderBy(enrollmentRequests.createdAt)
}

export async function updateRequest(
  id: string,
  data: Partial<typeof enrollmentRequests.$inferInsert>
) {
  const [row] = await db
    .update(enrollmentRequests)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(enrollmentRequests.id, id))
    .returning()
  return row
}

/** Classes a faculty coordinates/teaches, for the class index. */
export async function getClassesByIds(ids: string[]) {
  if (ids.length === 0) return []
  return db.query.classes.findMany({
    where: (c, { inArray }) => inArray(c.id, ids),
    orderBy: [desc(classes.admissionYear), classes.division],
  })
}
