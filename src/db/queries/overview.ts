// Scoped data for the role-specific overview.
//
// The dashboard used to run four unscoped counts — departments, classes,
// students, faculty — and show the same institution-wide totals to everyone. A
// TR who can open one class was told there are 168 students, which is both a
// scope leak and useless: a number nobody can act on is not information.
//
// Everything here is filtered by the caller's own scope and answers "what needs
// me today" rather than "how big is the college".

import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  classes,
  courseOfferings,
  courses,
  enrollmentRequests,
  faculty,
  facultyClassAssignments,
  attendance as attendanceTable,
  marks as marksTable,
  students,
  departments,
  deptAppointments,
} from "@/db/schema"

export type ClassWork = {
  classId: string
  classKey: string
  admissionYear: number
  division: string
  departmentCode: string
  role: "academic_coordinator" | "tr" | "hod" | "admin"
  students: number
  pendingRequests: number
  markedToday: number
  mySubjects: { id: string; code: string; name: string; entered: number }[]
  unallocatedSubjects: number
}

/**
 * The classes this person is responsible for, each with the work outstanding on
 * it. `facultyId` null means an unscoped viewer (super-admin) and the caller is
 * expected to have narrowed `classIds` already.
 */
export async function getClassWork(
  classIds: string[],
  facultyId: string | null,
  today: string
): Promise<ClassWork[]> {
  if (classIds.length === 0) return []

  const rows = await db
    .select()
    .from(classes)
    .where(inArray(classes.id, classIds))

  const [staff, offerings, requests] = await Promise.all([
    db
      .select({
        classId: facultyClassAssignments.classId,
        facultyId: facultyClassAssignments.facultyId,
        role: facultyClassAssignments.role,
      })
      .from(facultyClassAssignments)
      .where(
        and(
          inArray(facultyClassAssignments.classId, classIds),
          eq(facultyClassAssignments.isActive, true)
        )
      ),
    db
      .select({
        id: courseOfferings.id,
        classId: courseOfferings.classId,
        facultyId: courseOfferings.facultyId,
        code: courses.courseCode,
        name: courses.courseName,
      })
      .from(courseOfferings)
      .innerJoin(courses, eq(courseOfferings.courseId, courses.id))
      .where(
        and(
          inArray(courseOfferings.classId, classIds),
          eq(courseOfferings.isActive, true)
        )
      ),
    db
      .select({
        classId: enrollmentRequests.classId,
        n: sql<number>`count(*)::int`,
      })
      .from(enrollmentRequests)
      .where(
        and(
          inArray(enrollmentRequests.classId, classIds),
          eq(enrollmentRequests.status, "pending")
        )
      )
      .groupBy(enrollmentRequests.classId),
  ])

  const offeringIds = offerings.map((o) => o.id)
  const [rosterCounts, markCounts, todayMarked] = await Promise.all([
    db
      .select({ classKey: students.classKey, n: sql<number>`count(*)::int` })
      .from(students)
      .where(
        and(
          eq(students.isActive, true),
          inArray(
            students.classKey,
            rows.map((r) => r.classKey)
          )
        )
      )
      .groupBy(students.classKey),
    offeringIds.length
      ? db
          .select({
            offeringId: marksTable.courseOfferingId,
            n: sql<number>`count(*)::int`,
          })
          .from(marksTable)
          .where(inArray(marksTable.courseOfferingId, offeringIds))
          .groupBy(marksTable.courseOfferingId)
      : Promise.resolve([]),
    db
      .select({
        classId: attendanceTable.classId,
        n: sql<number>`count(*)::int`,
      })
      .from(attendanceTable)
      .where(
        and(
          inArray(attendanceTable.classId, classIds),
          eq(attendanceTable.sessionDate, today)
        )
      )
      .groupBy(attendanceTable.classId),
  ])

  const num = <T extends { n: number }>(
    list: T[],
    pick: (t: T) => string | null
  ) => new Map(list.map((x) => [pick(x) ?? "", x.n]))
  const roster = num(rosterCounts, (r) => r.classKey)
  const marked = num(todayMarked, (r) => r.classId)
  const pending = num(requests, (r) => r.classId)
  const entered = num(markCounts, (r) => r.offeringId)

  return rows.map((c) => {
    const mine = offerings.filter(
      (o) =>
        o.classId === c.id && (facultyId === null || o.facultyId === facultyId)
    )
    const isCoord = staff.some(
      (s) =>
        s.classId === c.id &&
        s.facultyId === facultyId &&
        s.role === "academic_coordinator"
    )
    return {
      classId: c.id,
      classKey: c.classKey,
      admissionYear: c.admissionYear,
      division: c.division,
      departmentCode: c.departmentCode,
      role:
        facultyId === null ? "admin" : isCoord ? "academic_coordinator" : "tr",
      students: roster.get(c.classKey) ?? 0,
      pendingRequests: pending.get(c.id) ?? 0,
      markedToday: marked.get(c.id) ?? 0,
      mySubjects: mine.map((o) => ({
        id: o.id,
        code: o.code,
        name: o.name,
        entered: entered.get(o.id) ?? 0,
      })),
      unallocatedSubjects: offerings.filter(
        (o) => o.classId === c.id && o.facultyId === null
      ).length,
    }
  })
}

export type DeptHealth = {
  code: string
  name: string
  hod: string | null
  classes: number
  classesWithoutCoordinator: number
  faculty: number
  students: number
  unclaimedStudents: number
  unallocatedSubjects: number
}

/** Department health for an HOD or super-admin, scoped to the codes given. */
export async function getDeptHealth(
  deptCodes: string[]
): Promise<DeptHealth[]> {
  if (deptCodes.length === 0) return []

  const [depts, cls, fac, stu, appts] = await Promise.all([
    db.select().from(departments).where(inArray(departments.code, deptCodes)),
    db
      .select()
      .from(classes)
      .where(
        and(
          inArray(classes.departmentCode, deptCodes),
          eq(classes.isActive, true)
        )
      ),
    db
      .select({ department: faculty.department, n: sql<number>`count(*)::int` })
      .from(faculty)
      .where(
        and(inArray(faculty.department, deptCodes), eq(faculty.isActive, true))
      )
      .groupBy(faculty.department),
    db
      .select({
        department: students.department,
        n: sql<number>`count(*)::int`,
        unclaimed: sql<number>`count(*) filter (where ${students.authUserId} is null)::int`,
      })
      .from(students)
      .where(
        and(
          inArray(students.department, deptCodes),
          eq(students.isActive, true)
        )
      )
      .groupBy(students.department),
    db
      .select({
        deptCode: deptAppointments.deptCode,
        first: faculty.firstName,
        last: faculty.lastName,
      })
      .from(deptAppointments)
      .innerJoin(faculty, eq(deptAppointments.facultyId, faculty.id))
      .where(
        and(
          inArray(deptAppointments.deptCode, deptCodes),
          eq(deptAppointments.appointment, "hod"),
          eq(deptAppointments.isActive, true)
        )
      ),
  ])

  const classIds = cls.map((c) => c.id)
  const [coords, unallocated] = await Promise.all([
    classIds.length
      ? db
          .select({ classId: facultyClassAssignments.classId })
          .from(facultyClassAssignments)
          .where(
            and(
              inArray(facultyClassAssignments.classId, classIds),
              eq(facultyClassAssignments.role, "academic_coordinator"),
              eq(facultyClassAssignments.isActive, true)
            )
          )
      : Promise.resolve([]),
    classIds.length
      ? db
          .select({ classId: courseOfferings.classId })
          .from(courseOfferings)
          .where(
            and(
              inArray(courseOfferings.classId, classIds),
              eq(courseOfferings.isActive, true),
              isNull(courseOfferings.facultyId)
            )
          )
      : Promise.resolve([]),
  ])

  const withCoord = new Set(coords.map((c) => c.classId))
  return depts.map((d) => {
    const mine = cls.filter((c) => c.departmentCode === d.code)
    const s = stu.find((x) => x.department === d.code)
    const a = appts.find((x) => x.deptCode === d.code)
    return {
      code: d.code,
      name: d.name,
      hod: a ? `${a.first} ${a.last}`.trim() : null,
      classes: mine.length,
      classesWithoutCoordinator: mine.filter((c) => !withCoord.has(c.id))
        .length,
      faculty: fac.find((x) => x.department === d.code)?.n ?? 0,
      students: s?.n ?? 0,
      unclaimedStudents: s?.unclaimed ?? 0,
      unallocatedSubjects: unallocated.filter((u) =>
        mine.some((c) => c.id === u.classId)
      ).length,
    }
  })
}
