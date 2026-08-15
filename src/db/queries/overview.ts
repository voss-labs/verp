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
import { completeCount } from "@/lib/marks-integrity"
import type { MarksInput } from "@/lib/sgpi"
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
        maxIsa: courses.maxIsa,
        maxMse: courses.maxMse,
        maxEse: courses.maxEse,
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
    // Ids, not a count: completeness is asked per student, and the count falls
    // out of the same rows.
    db
      .select({ id: students.id, classKey: students.classKey })
      .from(students)
      .where(
        and(
          eq(students.isActive, true),
          inArray(
            students.classKey,
            rows.map((r) => r.classKey)
          )
        )
      ),
    // Every mark for these offerings, not a count of rows. "89 of 89 entered"
    // was reported for a register where almost every row was blank: a row is
    // created the moment anybody touches a student, so counting rows answers
    // "how many students has somebody opened" rather than "how many are
    // marked".
    offeringIds.length
      ? db
          .select({
            offeringId: marksTable.courseOfferingId,
            studentId: marksTable.studentId,
            isa: marksTable.isa,
            mse1: marksTable.mse1,
            mse2: marksTable.mse2,
            ese: marksTable.ese,
          })
          .from(marksTable)
          .where(inArray(marksTable.courseOfferingId, offeringIds))
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
  const rosterIds = new Map<string, string[]>()
  for (const r of rosterCounts) {
    const key = r.classKey ?? ""
    const list = rosterIds.get(key) ?? []
    list.push(r.id)
    rosterIds.set(key, list)
  }
  const marked = num(todayMarked, (r) => r.classId)
  const pending = num(requests, (r) => r.classId)

  // Marks grouped by offering, so completeness can be asked per student.
  const marksByOffering = new Map<string, Map<string, MarksInput>>()
  for (const m of markCounts) {
    const key = m.offeringId ?? ""
    let inner = marksByOffering.get(key)
    if (!inner) {
      inner = new Map()
      marksByOffering.set(key, inner)
    }
    inner.set(m.studentId, m)
  }

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
      students: (rosterIds.get(c.classKey) ?? []).length,
      pendingRequests: pending.get(c.id) ?? 0,
      markedToday: marked.get(c.id) ?? 0,
      mySubjects: mine.map((o) => ({
        id: o.id,
        code: o.code,
        name: o.name,
        entered: completeCount(
          rosterIds.get(c.classKey) ?? [],
          marksByOffering.get(o.id) ?? new Map(),
          {
            courseType: "theory",
            credits: 0,
            maxIsa: o.maxIsa,
            maxMse: o.maxMse,
            maxEse: o.maxEse,
            maxTotal: o.maxIsa + o.maxMse + o.maxEse,
          }
        ),
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
