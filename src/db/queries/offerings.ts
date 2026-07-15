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

// Every subject a class is being taught, with the course details.
export async function listOfferingsForClass(classId: string) {
  return db.query.courseOfferings.findMany({
    where: and(
      eq(courseOfferings.classId, classId),
      eq(courseOfferings.isActive, true)
    ),
    with: { course: true },
    orderBy: courseOfferings.semester,
  })
}
