// Scoped data for the role-specific overview.
//
// The dashboard used to run four unscoped counts — departments, classes,
// students, faculty — and show the same institution-wide totals to everyone. A
// TR who can open one class was told there are 168 students, which is both a
// scope leak and useless: a number nobody can act on is not information.
//
// Everything here is filtered by the caller's own scope and answers "what needs
// me today" rather than "how big is the college".

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  completeCount,
  incompleteStudents,
  requiredComponents,
  type Component,
} from "@/lib/marks-integrity"
import type { CourseInfo, MarksInput } from "@/lib/sgpi"
import type { ImportKind, ImportStatus } from "@/db/schema/import-batches"
import { getAuditLogs } from "./audit"
import {
  importScopeFor,
  listImportBatches,
  type ImportViewer,
} from "./import-batches"
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

type OfferingRow = {
  id: string
  classId: string
  facultyId: string | null
  code: string
  name: string
  publishedAt: Date | null
  maxIsa: number
  maxMse: number
  maxEse: number
}

function courseCaps(o: {
  maxIsa: number
  maxMse: number
  maxEse: number
}): CourseInfo {
  return {
    courseType: "theory",
    credits: 0,
    maxIsa: o.maxIsa,
    maxMse: o.maxMse,
    maxEse: o.maxEse,
    maxTotal: o.maxIsa + o.maxMse + o.maxEse,
  }
}

async function activeOfferings(classIds: string[]): Promise<OfferingRow[]> {
  if (classIds.length === 0) return []
  return db
    .select({
      id: courseOfferings.id,
      classId: courseOfferings.classId,
      facultyId: courseOfferings.facultyId,
      code: courses.courseCode,
      name: courses.courseName,
      publishedAt: courseOfferings.publishedAt,
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
    )
}

// Ids, not a count: completeness is asked per student, and the count falls out
// of the same rows.
async function rosterIdsByClassKey(
  classKeys: string[]
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (classKeys.length === 0) return out
  const rows = await db
    .select({ id: students.id, classKey: students.classKey })
    .from(students)
    .where(
      and(eq(students.isActive, true), inArray(students.classKey, classKeys))
    )
  for (const r of rows) {
    const key = r.classKey ?? ""
    const list = out.get(key) ?? []
    list.push(r.id)
    out.set(key, list)
  }
  return out
}

/**
 * Every mark for these offerings, not a count of rows. "89 of 89 entered" was
 * reported for a register where almost every row was blank: a row is created
 * the moment anybody touches a student, so counting rows answers "how many
 * students has somebody opened" rather than "how many are marked".
 */
async function marksByOfferingId(
  offeringIds: string[]
): Promise<Map<string, Map<string, MarksInput>>> {
  const out = new Map<string, Map<string, MarksInput>>()
  if (offeringIds.length === 0) return out
  const rows = await db
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
  for (const m of rows) {
    const key = m.offeringId ?? ""
    let inner = out.get(key)
    if (!inner) {
      inner = new Map()
      out.set(key, inner)
    }
    inner.set(m.studentId, m)
  }
  return out
}

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
    activeOfferings(classIds),
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

  const [rosterIds, marksByOffering, todayMarked] = await Promise.all([
    rosterIdsByClassKey(rows.map((r) => r.classKey)),
    marksByOfferingId(offerings.map((o) => o.id)),
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
  const marked = num(todayMarked, (r) => r.classId)
  const pending = num(requests, (r) => r.classId)

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
          courseCaps(o)
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

// ── scoped aggregates for the per-role overview ────────────────────────────
//
// `deptCodes` null means an unscoped viewer (super-admin) and resolves to every
// active department. An empty array means no scope at all and returns nothing —
// a caller that forgot to pass its scope gets no rows rather than the college.

async function scopedDeptCodes(deptCodes: string[] | null): Promise<string[]> {
  if (deptCodes) return deptCodes
  const rows = await db
    .select({ code: departments.code })
    .from(departments)
    .where(eq(departments.isActive, true))
  return rows.map((r) => r.code)
}

type ScopedClass = { id: string; classKey: string; departmentCode: string }

async function activeClassesInDepts(
  deptCodes: string[]
): Promise<ScopedClass[]> {
  if (deptCodes.length === 0) return []
  return db
    .select({
      id: classes.id,
      classKey: classes.classKey,
      departmentCode: classes.departmentCode,
    })
    .from(classes)
    .where(
      and(
        inArray(classes.departmentCode, deptCodes),
        eq(classes.isActive, true)
      )
    )
}

export type DeptRegisters = {
  code: string
  classes: number
  classesMarked: number
}

/** How many of a department's classes have a register for the day. */
export async function registersTodayByDept(
  deptCodes: string[] | null,
  dateKey: string
): Promise<DeptRegisters[]> {
  const codes = await scopedDeptCodes(deptCodes)
  const cls = await activeClassesInDepts(codes)
  const marked = cls.length
    ? await db
        .selectDistinct({ classId: attendanceTable.classId })
        .from(attendanceTable)
        .where(
          and(
            inArray(
              attendanceTable.classId,
              cls.map((c) => c.id)
            ),
            eq(attendanceTable.sessionDate, dateKey)
          )
        )
    : []

  const markedIds = new Set(marked.map((m) => m.classId))
  return codes.map((code) => {
    const mine = cls.filter((c) => c.departmentCode === code)
    return {
      code,
      classes: mine.length,
      classesMarked: mine.filter((c) => markedIds.has(c.id)).length,
    }
  })
}

/** Enrolment requests waiting on a decision across the scope's active classes. */
export async function pendingEnrolmentsForDepts(
  deptCodes: string[] | null
): Promise<number> {
  const cls = await activeClassesInDepts(await scopedDeptCodes(deptCodes))
  if (cls.length === 0) return 0

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(enrollmentRequests)
    .where(
      and(
        inArray(
          enrollmentRequests.classId,
          cls.map((c) => c.id)
        ),
        eq(enrollmentRequests.status, "pending")
      )
    )
  return row?.n ?? 0
}

export type ClassRegister = {
  classId: string
  classKey: string
  marked: number
  roster: number
}

/**
 * The day's register per class: students marked against roster size. Distinct
 * students, not rows — a class taught in two slots marks the same person twice
 * and counting rows would report more marked than the class has.
 */
export async function registersTodayByClass(
  classIds: string[],
  dateKey: string
): Promise<ClassRegister[]> {
  if (classIds.length === 0) return []

  const rows = await db
    .select({ id: classes.id, classKey: classes.classKey })
    .from(classes)
    .where(inArray(classes.id, classIds))
  if (rows.length === 0) return []

  const [roster, marked] = await Promise.all([
    rosterIdsByClassKey(rows.map((r) => r.classKey)),
    db
      .select({
        classId: attendanceTable.classId,
        n: sql<number>`count(distinct ${attendanceTable.studentId})::int`,
      })
      .from(attendanceTable)
      .where(
        and(
          inArray(attendanceTable.classId, classIds),
          eq(attendanceTable.sessionDate, dateKey)
        )
      )
      .groupBy(attendanceTable.classId),
  ])

  const byClass = new Map(marked.map((m) => [m.classId, m.n]))
  return rows.map((c) => ({
    classId: c.id,
    classKey: c.classKey,
    marked: byClass.get(c.id) ?? 0,
    roster: (roster.get(c.classKey) ?? []).length,
  }))
}

function isFullyEntered(
  offering: OfferingRow,
  roster: string[],
  entered: Map<string, MarksInput>
): boolean {
  if (roster.length === 0) return false
  const required = requiredComponents(courseCaps(offering))
  return incompleteStudents(roster, entered, required).length === 0
}

export type DeptMarksCompletion = {
  code: string
  offerings: number
  offeringsComplete: number
  offeringsPublished: number
}

/**
 * Marks progress per department. "Complete" is keyed on the roster — every
 * student carrying every component the course has — so a subject nobody has
 * finished cannot pass as done because a few rows exist.
 */
export async function marksCompletionByDept(
  deptCodes: string[] | null
): Promise<DeptMarksCompletion[]> {
  const codes = await scopedDeptCodes(deptCodes)
  const cls = await activeClassesInDepts(codes)
  const offerings = await activeOfferings(cls.map((c) => c.id))
  const [roster, marks] = await Promise.all([
    rosterIdsByClassKey(cls.map((c) => c.classKey)),
    marksByOfferingId(offerings.map((o) => o.id)),
  ])

  const keyOf = new Map(cls.map((c) => [c.id, c.classKey]))
  const deptOf = new Map(cls.map((c) => [c.id, c.departmentCode]))
  return codes.map((code) => {
    const mine = offerings.filter((o) => deptOf.get(o.classId) === code)
    return {
      code,
      offerings: mine.length,
      offeringsComplete: mine.filter((o) =>
        isFullyEntered(
          o,
          roster.get(keyOf.get(o.classId) ?? "") ?? [],
          marks.get(o.id) ?? new Map()
        )
      ).length,
      offeringsPublished: mine.filter((o) => o.publishedAt !== null).length,
    }
  })
}

export type OfferingCompletion = {
  offeringId: string
  classId: string
  courseCode: string
  courseName: string
  facultyId: string | null
  facultyName: string | null
  roster: number
  components: { component: Component; entered: number }[]
  publishedAt: Date | null
}

async function facultyNamesByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const rows = await db
    .select({
      id: faculty.id,
      first: faculty.firstName,
      last: faculty.lastName,
    })
    .from(faculty)
    .where(inArray(faculty.id, unique))
  return new Map(rows.map((r) => [r.id, `${r.first} ${r.last}`.trim()]))
}

/** Per-subject marks progress for the given classes, component by component. */
export async function marksCompletionByOffering(
  classIds: string[]
): Promise<OfferingCompletion[]> {
  if (classIds.length === 0) return []

  const cls = await db
    .select({ id: classes.id, classKey: classes.classKey })
    .from(classes)
    .where(inArray(classes.id, classIds))
  const offerings = await activeOfferings(cls.map((c) => c.id))
  const [roster, marks, teachers] = await Promise.all([
    rosterIdsByClassKey(cls.map((c) => c.classKey)),
    marksByOfferingId(offerings.map((o) => o.id)),
    facultyNamesByIds(
      offerings.flatMap((o) => (o.facultyId === null ? [] : [o.facultyId]))
    ),
  ])

  const keyOf = new Map(cls.map((c) => [c.id, c.classKey]))
  return offerings.map((o) => {
    const ids = roster.get(keyOf.get(o.classId) ?? "") ?? []
    const entered = marks.get(o.id) ?? new Map<string, MarksInput>()
    return {
      offeringId: o.id,
      classId: o.classId,
      courseCode: o.code,
      courseName: o.name,
      facultyId: o.facultyId,
      facultyName:
        o.facultyId === null ? null : (teachers.get(o.facultyId) ?? null),
      roster: ids.length,
      components: requiredComponents(courseCaps(o)).map((component) => ({
        component,
        entered:
          ids.length - incompleteStudents(ids, entered, [component]).length,
      })),
      publishedAt: o.publishedAt,
    }
  })
}

export type PendingEnrolment = {
  requestId: string
  classId: string
  rollNumber: string
  name: string
}

/** The coordinator's queue across every class they run, oldest request first. */
export async function pendingEnrolmentsForClasses(
  classIds: string[],
  limit: number
): Promise<PendingEnrolment[]> {
  if (classIds.length === 0 || limit <= 0) return []

  const rows = await db
    .select({
      id: enrollmentRequests.id,
      classId: enrollmentRequests.classId,
      rollNumber: enrollmentRequests.rollNumber,
      first: enrollmentRequests.firstName,
      last: enrollmentRequests.lastName,
    })
    .from(enrollmentRequests)
    .where(
      and(
        inArray(enrollmentRequests.classId, classIds),
        eq(enrollmentRequests.status, "pending")
      )
    )
    .orderBy(enrollmentRequests.createdAt)
    .limit(limit)

  return rows.map((r) => ({
    requestId: r.id,
    classId: r.classId ?? "",
    rollNumber: r.rollNumber,
    name: `${r.first} ${r.last}`.trim(),
  }))
}

export type AttendanceScope = {
  deptCodes?: string[] | null
  classIds?: string[]
}

export type AttendanceTrendPoint = {
  dateKey: string
  present: number
  marked: number
}

/**
 * The last `days` dates that carry any register, oldest first. A late arrival
 * counts as present, as it does in the per-subject figure. Dates with no session
 * are absent rather than plotted as zero — a holiday is not a day nobody
 * attended — and the percentage is left to the caller.
 */
export async function attendanceTrendByScope(
  scope: AttendanceScope,
  days: number
): Promise<AttendanceTrendPoint[]> {
  if (days <= 0) return []

  const ids = new Set(scope.classIds ?? [])
  if (scope.deptCodes !== undefined) {
    const cls = await activeClassesInDepts(
      await scopedDeptCodes(scope.deptCodes)
    )
    for (const c of cls) ids.add(c.id)
  }
  if (ids.size === 0) return []

  const rows = await db
    .select({
      dateKey: attendanceTable.sessionDate,
      present: sql<number>`count(*) filter (where status in ('present','late'))::int`,
      marked: sql<number>`count(*)::int`,
    })
    .from(attendanceTable)
    .where(inArray(attendanceTable.classId, [...ids]))
    .groupBy(attendanceTable.sessionDate)
    .orderBy(desc(attendanceTable.sessionDate))
    .limit(days)

  return rows.reverse()
}

export type AuditEntry = {
  id: string
  when: Date
  action: string
  actorName: string | null
  targetLabel: string
}

const LABEL_KEYS = [
  "name",
  "courseCode",
  "rollNumber",
  "classKey",
  "email",
  "code",
  "batch",
]

function targetLabel(targetType: string, details: unknown): string {
  if (details && typeof details === "object") {
    const record = details as Record<string, unknown>
    for (const key of LABEL_KEYS) {
      const value = record[key]
      if (typeof value === "string" && value.length > 0) {
        return `${targetType} · ${value}`
      }
    }
  }
  return targetType
}

/** The activity feed, thinned to what a dashboard row can show. */
export async function recentAuditEntries(limit: number): Promise<AuditEntry[]> {
  const rows = await getAuditLogs({ limit })
  return rows.map((r) => ({
    id: r.id,
    when: r.createdAt,
    action: r.action,
    actorName: r.actorName,
    targetLabel: targetLabel(r.targetType, r.details),
  }))
}

export type ImportActivity = {
  id: string
  kind: ImportKind
  fileName: string
  rowCount: number
  status: ImportStatus
  scopeLabel: string
  actorName: string | null
  createdAt: Date
}

/** Recent uploads under the same visibility rule the import centre applies. */
export async function recentImportBatchesForScope(
  viewer: ImportViewer,
  limit: number
): Promise<ImportActivity[]> {
  const rows = await listImportBatches({
    scope: importScopeFor(viewer),
    limit,
  })
  return rows.map((b) => ({
    id: b.id,
    kind: b.kind,
    fileName: b.fileName,
    rowCount: b.rowCount,
    status: b.status,
    scopeLabel: b.scopeLabel,
    actorName: b.actorName,
    createdAt: b.createdAt,
  }))
}
