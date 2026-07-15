import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { marks, marksLocks } from "@/db/schema"

export async function getMarksByCourseOffering(courseOfferingId: string) {
  return db.query.marks.findMany({
    where: eq(marks.courseOfferingId, courseOfferingId),
    with: { student: true },
    orderBy: (m, { asc }) => [asc(m.studentId)],
  })
}

export async function getMarksByStudent(studentId: string) {
  return db.query.marks.findMany({
    where: eq(marks.studentId, studentId),
    with: {
      courseOffering: {
        with: {
          course: true,
          semester: { with: { academicYear: true } },
        },
      },
    },
  })
}

export async function getMarksByStudentAndSemester(
  studentId: string,
  semesterId: number
) {
  return db.query.marks
    .findMany({
      where: eq(marks.studentId, studentId),
      with: {
        courseOffering: {
          with: {
            course: true,
            semester: { with: { academicYear: true } },
          },
        },
      },
    })
    .then((results) =>
      results.filter((m) => m.courseOffering.semesterId === semesterId)
    )
}

export async function getAllMarksBySemester(semesterId: number) {
  return db.query.marks
    .findMany({
      with: {
        student: true,
        courseOffering: {
          with: {
            course: true,
            semester: { with: { academicYear: true } },
          },
        },
      },
    })
    .then((results) =>
      results.filter((m) => m.courseOffering.semesterId === semesterId)
    )
}

export async function getAllMarks() {
  return db.query.marks.findMany({
    with: {
      student: true,
      courseOffering: {
        with: {
          course: true,
          semester: { with: { academicYear: true } },
        },
      },
    },
  })
}

export async function upsertMarks(data: typeof marks.$inferInsert) {
  const [result] = await db
    .insert(marks)
    .values(data)
    .onConflictDoUpdate({
      target: [marks.courseOfferingId, marks.studentId],
      set: {
        isa: data.isa,
        mse1: data.mse1,
        mse2: data.mse2,
        ese: data.ese,
        updatedAt: new Date(),
      },
    })
    .returning()
  return result
}

export async function bulkUpsertMarks(entries: (typeof marks.$inferInsert)[]) {
  return db.transaction(async (tx) => {
    const results = []
    for (const entry of entries) {
      const [result] = await tx
        .insert(marks)
        .values(entry)
        .onConflictDoUpdate({
          target: [marks.courseOfferingId, marks.studentId],
          set: {
            isa: entry.isa,
            mse1: entry.mse1,
            mse2: entry.mse2,
            ese: entry.ese,
            updatedAt: new Date(),
          },
        })
        .returning()
      results.push(result)
    }
    return results
  })
}

export async function getMarksLock(
  courseOfferingId: string,
  component: string
) {
  return db.query.marksLocks.findFirst({
    where: and(
      eq(marksLocks.courseOfferingId, courseOfferingId),
      eq(marksLocks.component, component)
    ),
  })
}

export async function lockMarks(
  courseOfferingId: string,
  component: string,
  lockedBy: string
) {
  const [result] = await db
    .insert(marksLocks)
    .values({
      courseOfferingId,
      component,
      isLocked: true,
      lockedBy,
      lockedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [marksLocks.courseOfferingId, marksLocks.component],
      set: {
        isLocked: true,
        lockedBy,
        lockedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  return result
}

export async function unlockMarks(
  courseOfferingId: string,
  component: string,
  unlockedBy: string
) {
  const [result] = await db
    .insert(marksLocks)
    .values({
      courseOfferingId,
      component,
      isLocked: false,
      unlockedBy,
      unlockedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [marksLocks.courseOfferingId, marksLocks.component],
      set: {
        isLocked: false,
        unlockedBy,
        unlockedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  return result
}
