import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { courseOfferings } from "@/db/schema"

export async function createOffering(input: {
  courseId: string
  classId: string
  facultyId: string | null
  semester: number
}) {
  const [row] = await db.insert(courseOfferings).values(input).returning()
  return row
}

export async function getOfferingById(id: string) {
  return db.query.courseOfferings.findFirst({
    where: eq(courseOfferings.id, id),
    with: { course: true, class: true },
  })
}

// Every subject a class is being taught, with the course and the faculty who
// teaches it. Pass facultyId to narrow to one teacher's subjects — a TR is shown
// what they are responsible for, not the whole class's timetable.
export async function listOfferingsForClass(
  classId: string,
  facultyId?: string
) {
  return db.query.courseOfferings.findMany({
    where: and(
      eq(courseOfferings.classId, classId),
      eq(courseOfferings.isActive, true),
      facultyId ? eq(courseOfferings.facultyId, facultyId) : undefined
    ),
    with: { course: true, faculty: true },
    orderBy: courseOfferings.semester,
  })
}

/**
 * Hand a subject to a different teacher. Nullable: an offering with no faculty
 * is unallocated, which is a real state at the start of term and better than
 * silently leaving it with whoever happened to create it.
 */
export async function setOfferingFaculty(id: string, facultyId: string | null) {
  const [row] = await db
    .update(courseOfferings)
    .set({ facultyId, updatedAt: new Date() })
    .where(eq(courseOfferings.id, id))
    .returning()
  return row
}

/**
 * Publish or withdraw a subject's results.
 *
 * Withdrawing is deliberately possible: a result published against a mark that
 * turns out to be wrong has to be retractable, and the alternative — leaving it
 * visible while it is corrected — is worse than briefly taking it back.
 */
export async function setOfferingPublished(
  id: string,
  publishedByFacultyId: string | null,
  published: boolean
) {
  const [row] = await db
    .update(courseOfferings)
    .set(
      published
        ? {
            publishedAt: new Date(),
            publishedByFacultyId,
            updatedAt: new Date(),
          }
        : {
            publishedAt: null,
            publishedByFacultyId: null,
            updatedAt: new Date(),
          }
    )
    .where(eq(courseOfferings.id, id))
    .returning()
  return row
}
