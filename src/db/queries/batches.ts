import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { batches, batchAssignments } from "@/db/schema"

/** Batches for one offering, each with the students sitting in it. */
export async function listBatchesForOffering(courseOfferingId: string) {
  return db.query.batches.findMany({
    where: and(
      eq(batches.courseOfferingId, courseOfferingId),
      eq(batches.isActive, true)
    ),
    with: {
      assignments: {
        where: (a, { eq }) => eq(a.isActive, true),
        with: { student: true },
      },
    },
    orderBy: batches.name,
  })
}

export async function createBatch(input: {
  courseOfferingId: string
  name: string
}) {
  const [row] = await db
    .insert(batches)
    .values({ courseOfferingId: input.courseOfferingId, name: input.name })
    .returning()
  return row
}

export async function getBatchById(id: string) {
  return db.query.batches.findFirst({
    where: eq(batches.id, id),
    with: { offering: true },
  })
}

export async function setBatchActive(id: string, isActive: boolean) {
  const [row] = await db
    .update(batches)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(batches.id, id))
    .returning()
  return row
}

/**
 * Move students into a batch. A student sits in exactly one batch per offering,
 * so any other live assignment for the same offering is retired first —
 * otherwise a re-shuffle would leave them registered for two lab sessions.
 */
export async function assignStudentsToBatch(input: {
  batchId: string
  courseOfferingId: string
  studentIds: string[]
}) {
  if (input.studentIds.length === 0) return

  const siblings = await db
    .select({ id: batches.id })
    .from(batches)
    .where(eq(batches.courseOfferingId, input.courseOfferingId))

  await db
    .update(batchAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        inArray(
          batchAssignments.batchId,
          siblings.map((b) => b.id)
        ),
        inArray(batchAssignments.studentId, input.studentIds),
        eq(batchAssignments.isActive, true)
      )
    )

  await db
    .insert(batchAssignments)
    .values(
      input.studentIds.map((studentId) => ({
        batchId: input.batchId,
        studentId,
      }))
    )
    .onConflictDoUpdate({
      target: [batchAssignments.batchId, batchAssignments.studentId],
      set: { isActive: true, updatedAt: new Date() },
    })
}

export async function removeStudentFromBatch(input: {
  batchId: string
  studentId: string
}) {
  await db
    .update(batchAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(batchAssignments.batchId, input.batchId),
        eq(batchAssignments.studentId, input.studentId)
      )
    )
}
