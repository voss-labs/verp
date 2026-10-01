import { and, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/db"
import { electiveEnrollments, marks } from "@/db/schema"
import { offeringRoster } from "@/lib/electives"
import { getStudentsByClassKeys } from "./students"

/** The students put on one elective, as ids. Not yet narrowed to its class. */
export async function getElectiveMemberIds(
  courseOfferingId: string
): Promise<Set<string>> {
  const rows = await db
    .select({ studentId: electiveEnrollments.studentId })
    .from(electiveEnrollments)
    .where(
      and(
        eq(electiveEnrollments.courseOfferingId, courseOfferingId),
        eq(electiveEnrollments.isActive, true)
      )
    )
  return new Set(rows.map((r) => r.studentId))
}

/** The same for many offerings in one read, for the dashboards. */
export async function electiveMembersByOffering(
  offeringIds: string[]
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  if (offeringIds.length === 0) return out
  const rows = await db
    .select({
      offeringId: electiveEnrollments.courseOfferingId,
      studentId: electiveEnrollments.studentId,
    })
    .from(electiveEnrollments)
    .where(
      and(
        inArray(electiveEnrollments.courseOfferingId, offeringIds),
        eq(electiveEnrollments.isActive, true)
      )
    )
  for (const r of rows) {
    const members = out.get(r.offeringId) ?? new Set<string>()
    members.add(r.studentId)
    out.set(r.offeringId, members)
  }
  return out
}

/**
 * The students a subject is taught to, in roll order: the class, or for an
 * elective the students in it who are taking it.
 *
 * The marks grid, the register, and the completeness that locking and
 * publishing wait for all read this, so an elective cannot be narrow in one of
 * them and the whole division in another.
 */
export async function getOfferingRoster(
  offering: { id: string; isElective: boolean },
  classKey: string
) {
  const [classRoster, enrolled] = await Promise.all([
    getStudentsByClassKeys([classKey]),
    offering.isElective
      ? getElectiveMemberIds(offering.id)
      : Promise.resolve(new Set<string>()),
  ])
  return offeringRoster(offering, classRoster, enrolled)
}

/**
 * Put students on an elective. Somebody taken off and put back gets their old
 * row revived rather than a second one, so they cannot be listed twice.
 */
export async function enrollInElective(input: {
  courseOfferingId: string
  studentIds: string[]
}) {
  // Each student once: the same key twice in one INSERT ... ON CONFLICT DO
  // UPDATE fails the whole statement.
  const studentIds = [...new Set(input.studentIds)]
  if (studentIds.length === 0) return
  await db
    .insert(electiveEnrollments)
    .values(
      studentIds.map((studentId) => ({
        courseOfferingId: input.courseOfferingId,
        studentId,
      }))
    )
    .onConflictDoUpdate({
      target: [
        electiveEnrollments.courseOfferingId,
        electiveEnrollments.studentId,
      ],
      set: { isActive: true, updatedAt: new Date() },
    })
}

export async function removeFromElective(input: {
  courseOfferingId: string
  studentId: string
}) {
  await db
    .update(electiveEnrollments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(electiveEnrollments.courseOfferingId, input.courseOfferingId),
        eq(electiveEnrollments.studentId, input.studentId)
      )
    )
}

/**
 * Take everybody off an elective, as when it goes back to being taught to the
 * whole class. Its list ends there rather than waiting, unseen, to come back
 * the next time the subject is made an elective.
 */
export async function clearElective(courseOfferingId: string) {
  const rows = await db
    .update(electiveEnrollments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(electiveEnrollments.courseOfferingId, courseOfferingId),
        eq(electiveEnrollments.isActive, true)
      )
    )
    .returning({ id: electiveEnrollments.id })
  return rows.length
}

/**
 * Delete a subject's marks rows that record nothing — all of them, or one
 * student's.
 *
 * The grid saves every row it shows, so a subject taught to the whole class
 * leaves an empty row behind for everybody nobody marked. That is harmless
 * while they all take it. Once it is an elective, the students who never took
 * it would keep that row, and an empty row puts the subject on a student's own
 * record as a result they are waiting on. A row holding any value is never
 * touched.
 *
 * Here rather than with the marks queries because clearing them is only ever
 * part of changing who takes a subject.
 */
export async function deleteBlankMarks(
  courseOfferingId: string,
  studentId?: string
) {
  const rows = await db
    .delete(marks)
    .where(
      and(
        eq(marks.courseOfferingId, courseOfferingId),
        studentId ? eq(marks.studentId, studentId) : undefined,
        isNull(marks.isa),
        isNull(marks.mse1),
        isNull(marks.mse2),
        isNull(marks.ese)
      )
    )
    .returning({ id: marks.id })
  return rows.length
}
