import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { batches, batchAssignments, students } from "@/db/schema"
import { batchPlacesToRestore } from "@/lib/electives"

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

/** The students sitting in one batch, in the shape a roster is rendered in. */
export async function getStudentsInBatch(batchId: string) {
  return db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      rollNumber: students.rollNumber,
    })
    .from(batchAssignments)
    .innerJoin(students, eq(batchAssignments.studentId, students.id))
    .where(
      and(
        eq(batchAssignments.batchId, batchId),
        eq(batchAssignments.isActive, true),
        eq(students.isActive, true)
      )
    )
    .orderBy(asc(students.rollNumber))
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

/** The students holding a place in any of one offering's batches. */
export async function getBatchedStudentIds(
  courseOfferingId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ studentId: batchAssignments.studentId })
    .from(batchAssignments)
    .innerJoin(batches, eq(batchAssignments.batchId, batches.id))
    .where(
      and(
        eq(batches.courseOfferingId, courseOfferingId),
        eq(batchAssignments.isActive, true)
      )
    )
  return new Set(rows.map((r) => r.studentId))
}

/**
 * Take students out of an offering's batches, as when they stop taking it. The
 * place is switched off rather than deleted, so restoreBatchPlaces can give it
 * back if they take the subject again.
 */
export async function retireBatchPlaces(
  courseOfferingId: string,
  studentIds: string[]
) {
  if (studentIds.length === 0) return 0
  const siblings = await db
    .select({ id: batches.id })
    .from(batches)
    .where(eq(batches.courseOfferingId, courseOfferingId))
  if (siblings.length === 0) return 0
  const rows = await db
    .update(batchAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        inArray(
          batchAssignments.batchId,
          siblings.map((b) => b.id)
        ),
        inArray(batchAssignments.studentId, studentIds),
        eq(batchAssignments.isActive, true)
      )
    )
    .returning({ id: batchAssignments.id })
  return rows.length
}

/**
 * Give students who take an offering again the batch place they last held in
 * it. batchPlacesToRestore decides which, and leaves anybody already in one of
 * its batches where they are.
 */
export async function restoreBatchPlaces(
  courseOfferingId: string,
  studentIds: string[]
) {
  if (studentIds.length === 0) return 0
  const places = await db
    .select({
      id: batchAssignments.id,
      studentId: batchAssignments.studentId,
      isActive: batchAssignments.isActive,
      batchActive: batches.isActive,
      updatedAt: batchAssignments.updatedAt,
    })
    .from(batchAssignments)
    .innerJoin(batches, eq(batchAssignments.batchId, batches.id))
    .where(
      and(
        eq(batches.courseOfferingId, courseOfferingId),
        inArray(batchAssignments.studentId, studentIds)
      )
    )
  const ids = batchPlacesToRestore(places)
  if (ids.length === 0) return 0
  await db
    .update(batchAssignments)
    .set({ isActive: true, updatedAt: new Date() })
    .where(inArray(batchAssignments.id, ids))
  return ids.length
}
