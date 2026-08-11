"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, type SessionUser } from "@/lib/session"
import { authorize } from "@/lib/rbac"
import { getErrorMessage } from "@/lib/error-utils"
import { classKey, tryClassKeyFromRoll } from "@/lib/class-key"
import { BRANCH_CODE_BY_DEPT, divisionsForBranch } from "@/lib/roll-number"
import { createAuditLog } from "@/db/queries"
import {
  getCourseByCode,
  getCourseById,
  createCourse,
  updateCourse,
  setCourseActive,
} from "@/db/queries/courses"
import { graduateClassKey, ungraduateClassKey } from "@/db/queries/students"
import {
  createClass,
  getClassByKey,
  getClassById,
  setClassActive,
  listUnroutedRequests,
  routeRequestsToClass,
} from "@/db/queries/classes"
import { assignClassRole } from "@/db/queries/class-staff"
import { createFaculty, getFacultyByEmail } from "@/db/queries/faculty"

type Result = { error: string | null }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// An HOD adds a teaching faculty to their own department. Role is always the plain
// faculty tier — an HOD cannot mint another HOD or an admin (that stays super_admin).
export async function createDeptFacultyAction(input: {
  deptCode: string
  firstName: string
  lastName: string
  employeeId: string
  email: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:create")
    if (!inDeptScope(user!, input.deptCode))
      return { error: "That department is not in your scope." }

    const email = input.email.trim().toLowerCase()
    if (!input.firstName.trim()) return { error: "First name is required." }
    if (!input.employeeId.trim()) return { error: "Employee ID is required." }
    if (!EMAIL_RE.test(email)) return { error: "A valid email is required." }
    if (await getFacultyByEmail(email))
      return { error: `A faculty with ${email} already exists.` }

    const row = await createFaculty({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      employeeId: input.employeeId.trim(),
      email,
      department: input.deptCode,
      role: "faculty",
    })
    await createAuditLog({
      action: "faculty.created",
      actorId: user!.id,
      targetType: "faculty",
      targetId: row.id,
      details: { email, department: input.deptCode, by: "hod" },
    })
    revalidatePath("/dashboard/dept")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not add faculty") }
  }
}

// Bulk-create teaching staff in the HOD's department from an uploaded CSV, and
// optionally assign each to one class as coordinator/TR. An email already on a
// faculty row is reused (and still assigned), never duplicated.
export async function bulkImportFacultyAction(input: {
  deptCode: string
  rows: {
    firstName: string
    lastName: string
    email: string
    employeeId: string
  }[]
  assignClassId?: string | null
  assignRole?: "academic_coordinator" | "tr" | null
}): Promise<{
  error: string | null
  created?: number
  existing?: number
  assigned?: number
  failed?: number
}> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:create")
    if (!inDeptScope(user!, input.deptCode))
      return { error: "That department is not in your scope." }
    if (input.rows.length === 0) return { error: "No rows to import." }

    // An optional class assignment must target a class in this department.
    let assignClass: Awaited<ReturnType<typeof getClassById>> | null = null
    if (input.assignClassId && input.assignRole) {
      assignClass = await getClassById(input.assignClassId)
      if (!assignClass || assignClass.departmentCode !== input.deptCode)
        return { error: "That class is not in your department." }
    }

    let created = 0
    let existing = 0
    let assigned = 0
    let failed = 0
    for (const r of input.rows) {
      const email = r.email.trim().toLowerCase()
      const firstName = r.firstName.trim()
      const employeeId = r.employeeId.trim()
      if (!firstName || !employeeId || !EMAIL_RE.test(email)) {
        failed++
        continue
      }
      try {
        let fac = await getFacultyByEmail(email)
        if (fac) existing++
        else {
          fac = await createFaculty({
            firstName,
            lastName: r.lastName.trim(),
            employeeId,
            email,
            department: input.deptCode,
            role: "faculty",
          })
          created++
        }
        if (assignClass && fac && input.assignRole) {
          await assignClassRole(
            assignClass.id,
            fac.id,
            input.assignRole,
            user!.id
          )
          assigned++
        }
      } catch {
        failed++
      }
    }

    await createAuditLog({
      action: "faculty.bulk_import",
      actorId: user!.id,
      targetType: "faculty",
      details: {
        department: input.deptCode,
        created,
        existing,
        assigned,
        failed,
        assignedClass: assignClass?.classKey ?? null,
        role: input.assignRole ?? null,
      },
    })
    revalidatePath("/dashboard/dept")
    return { error: null, created, existing, assigned, failed }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not import faculty") }
  }
}

// A dept is in scope if the caller is super_admin (all) or an HOD of it.
function inDeptScope(user: SessionUser, deptCode: string): boolean {
  return user.tier === "super_admin" || user.deptCodes.includes(deptCode)
}

export async function createClassAction(input: {
  deptCode: string
  admissionYear: number
  division: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "class:create")
    if (!inDeptScope(user!, input.deptCode))
      return { error: "That department is not in your scope." }

    const branchCode = BRANCH_CODE_BY_DEPT[input.deptCode]
    if (!branchCode) return { error: `Unknown department ${input.deptCode}.` }

    const division = input.division.toUpperCase()
    if (!divisionsForBranch(branchCode).includes(division))
      return { error: `${input.deptCode} has no division ${division}.` }

    const year = Number(input.admissionYear)
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      return { error: "Enter a valid admission year." }

    const key = classKey(year, branchCode, division)
    if (await getClassByKey(key)) return { error: "That class already exists." }

    const row = await createClass({
      classKey: key,
      admissionYear: year,
      branchCode,
      departmentCode: input.deptCode,
      division,
    })

    // A class appearing may unblock students who self-registered before it
    // existed — re-queue any unrouted request whose roll resolves to this class.
    const unrouted = await listUnroutedRequests()
    const matched = unrouted
      .filter((r) => tryClassKeyFromRoll(r.rollNumber) === key)
      .map((r) => r.id)
    await routeRequestsToClass(matched, row.id)

    await createAuditLog({
      action: "class.created",
      actorId: user!.id,
      targetType: "class",
      targetId: row.id,
      details: { classKey: key, rerouted: matched.length },
    })
    revalidatePath("/dashboard/dept")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not create class") }
  }
}

export async function setClassActiveAction(input: {
  classId: string
  isActive: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, input.isActive ? "class:update" : "class:deactivate")
    const cls = await getClassById(input.classId)
    if (!cls) return { error: "No such class." }
    if (!inDeptScope(user!, cls.departmentCode))
      return { error: "That class is not in your scope." }
    await setClassActive(input.classId, input.isActive)
    await createAuditLog({
      action: input.isActive ? "class.enabled" : "class.disabled",
      actorId: user!.id,
      targetType: "class",
      targetId: input.classId,
    })
    revalidatePath("/dashboard/dept")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not update class") }
  }
}

export async function assignClassRoleAction(input: {
  classId: string
  facultyId: string
  role: "academic_coordinator" | "tr"
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "assignment:create")
    const cls = await getClassById(input.classId)
    if (!cls) return { error: "No such class." }
    if (!inDeptScope(user!, cls.departmentCode))
      return { error: "That class is not in your scope." }

    await assignClassRole(
      input.classId,
      input.facultyId,
      input.role,
      user!.facultyId
    )
    await createAuditLog({
      action:
        input.role === "academic_coordinator"
          ? "class.coordinator_assigned"
          : "class.tr_assigned",
      actorId: user!.id,
      targetType: "class",
      targetId: input.classId,
      details: { facultyId: input.facultyId },
    })
    revalidatePath("/dashboard/dept")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not assign") }
  }
}

/**
 * The catalogue is department-scoped: an HOD curates their own subjects and
 * nobody else's. course:update is the capability; the scope check is separate,
 * exactly as it is for classes and faculty.
 */
async function courseInScope(user: SessionUser, courseId: string) {
  const course = await getCourseById(courseId)
  if (!course) return { ok: false as const, course: null }
  // departmentCode is nullable: a course can be college-wide, owned by no single
  // department. Nobody's HOD scope covers that, so it stays super-admin-only
  // rather than falling to whichever HOD happens to open the page.
  const ok =
    user.tier === "super_admin" ||
    (course.departmentCode !== null &&
      user.deptCodes.includes(course.departmentCode))
  return { ok, course }
}

export async function updateCourseAction(input: {
  courseId: string
  courseName: string
  courseType: "theory" | "practical" | "project"
  year?: string | null
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "course:update")
    const { ok, course } = await courseInScope(user!, input.courseId)
    if (!ok || !course) return { error: "That course is not in your scope." }
    if (!input.courseName.trim()) return { error: "A course name is required." }
    if (input.credits < 1) return { error: "Credits must be at least 1." }
    if (input.maxIsa + input.maxMse + input.maxEse !== input.maxTotal) {
      return {
        error: `ISA + MSE + ESE must equal the total (${
          input.maxIsa + input.maxMse + input.maxEse
        } ≠ ${input.maxTotal}).`,
      }
    }

    await updateCourse(input.courseId, {
      courseName: input.courseName.trim(),
      courseType: input.courseType,
      year: input.year ?? null,
      credits: input.credits,
      maxIsa: input.maxIsa,
      maxMse: input.maxMse,
      maxEse: input.maxEse,
      maxTotal: input.maxTotal,
    })
    await createAuditLog({
      action: "course.updated",
      actorId: user!.id,
      targetType: "course",
      targetId: input.courseId,
      details: { courseCode: course.courseCode },
    })
    revalidatePath("/dashboard/dept/courses")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not update the course") }
  }
}

export async function setCourseActiveAction(input: {
  courseId: string
  isActive: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "course:update")
    const { ok, course } = await courseInScope(user!, input.courseId)
    if (!ok || !course) return { error: "That course is not in your scope." }

    await setCourseActive(input.courseId, input.isActive)
    await createAuditLog({
      action: input.isActive ? "course.reactivated" : "course.deactivated",
      actorId: user!.id,
      targetType: "course",
      targetId: input.courseId,
      details: { courseCode: course.courseCode },
    })
    revalidatePath("/dashboard/dept/courses")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not change the course") }
  }
}

/**
 * Graduate a cohort.
 *
 * Keyed by class_key, not by a list of student ids: graduation happens to a
 * cohort, and naming the cohort is what makes it idempotent — a student who
 * transferred in after the first run is picked up, and one already graduated is
 * skipped rather than re-stamped with a new date.
 *
 * Nobody is deactivated. A graduated student's marks and attendance still have
 * to be readable; isActive answers "should this row exist", which is a different
 * question from "have they finished".
 */
export async function graduateClassAction(input: {
  classId: string
  graduated: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "student:update")
    const cls = await getClassById(input.classId)
    if (!cls) return { error: "No such class." }
    const inScope =
      user!.tier === "super_admin" ||
      user!.deptCodes.includes(cls.departmentCode)
    if (!inScope) return { error: "That class is not in your scope." }

    const count = input.graduated
      ? await graduateClassKey(cls.classKey, new Date())
      : await ungraduateClassKey(cls.classKey)

    await createAuditLog({
      action: input.graduated ? "class.graduated" : "class.ungraduated",
      actorId: user!.id,
      targetType: "class",
      targetId: input.classId,
      details: { classKey: cls.classKey, students: count },
    })
    revalidatePath("/dashboard/dept")
    revalidatePath("/dashboard/students")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not graduate the class") }
  }
}

/**
 * Create a course directly in the catalogue.
 *
 * Until now a course could only appear as a side effect of a TR adding a
 * subject to a class, which left the catalogue with a chicken-and-egg: an HOD
 * opening it before term starts had no way to put anything in it, and the
 * subjects that did exist were shaped by whoever happened to type them first.
 * Curating the catalogue up front is the HOD's job; the class-level path stays
 * for a TR who needs a subject that was never catalogued.
 */
export async function createCourseAction(input: {
  courseCode: string
  courseName: string
  departmentCode: string
  courseType: "theory" | "practical" | "project"
  year?: string | null
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "course:create")
    const inScope =
      user!.tier === "super_admin" ||
      user!.deptCodes.includes(input.departmentCode)
    if (!inScope) return { error: "That department is not in your scope." }

    const code = input.courseCode.trim().toUpperCase()
    if (!code || !input.courseName.trim()) {
      return { error: "A course code and name are required." }
    }
    if (input.credits < 1) return { error: "Credits must be at least 1." }
    if (input.maxIsa + input.maxMse + input.maxEse !== input.maxTotal) {
      return {
        error: `ISA + MSE + ESE must equal the total (${
          input.maxIsa + input.maxMse + input.maxEse
        } ≠ ${input.maxTotal}).`,
      }
    }

    // The code is unique across the college — a subject taught to several
    // departments is one row, not one per department.
    const existing = await getCourseByCode(code)
    if (existing) {
      return { error: `${code} already exists (${existing.courseName}).` }
    }

    const course = await createCourse({
      courseCode: code,
      courseName: input.courseName.trim(),
      departmentCode: input.departmentCode,
      courseType: input.courseType,
      year: input.year ?? null,
      credits: input.credits,
      maxIsa: input.maxIsa,
      maxMse: input.maxMse,
      maxEse: input.maxEse,
      maxTotal: input.maxTotal,
    })
    await createAuditLog({
      action: "course.created",
      actorId: user!.id,
      targetType: "course",
      targetId: course.id,
      details: { courseCode: code, departmentCode: input.departmentCode },
    })
    revalidatePath("/dashboard/dept/courses")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not create the course") }
  }
}

/**
 * Import a reviewed batch of courses.
 *
 * Everything here has already been through the preview grid, so the rows are
 * what a human approved rather than what a parser produced. Codes that already
 * exist are skipped rather than failing the batch: a syllabus shares courses
 * across regulations, so re-importing an adjacent year is normal and should be
 * a no-op for the overlap, not an error.
 */
export async function bulkCreateCoursesAction(input: {
  departmentCode: string
  /** Which year of the programme this syllabus covers. */
  year?: string | null
  courses: {
    courseCode: string
    courseName: string
    courseType: "theory" | "practical" | "project"
    credits: number
    maxIsa: number
    maxMse: number
    maxEse: number
    maxTotal: number
  }[]
}): Promise<Result & { created?: number; skipped?: number }> {
  try {
    const user = await getSessionUser()
    authorize(user, "course:create")
    const inScope =
      user!.tier === "super_admin" ||
      user!.deptCodes.includes(input.departmentCode)
    if (!inScope) return { error: "That department is not in your scope." }
    if (input.courses.length === 0) return { error: "Nothing selected." }

    let created = 0
    let skipped = 0
    const problems: string[] = []

    for (const c of input.courses) {
      const code = c.courseCode.trim().toUpperCase()
      if (!code || !c.courseName.trim()) {
        problems.push(`${code || "(no code)"}: needs a code and a name`)
        continue
      }
      if (c.maxIsa + c.maxMse + c.maxEse !== c.maxTotal) {
        problems.push(`${code}: marks do not sum to the total`)
        continue
      }
      if (await getCourseByCode(code)) {
        skipped++
        continue
      }
      await createCourse({
        courseCode: code,
        courseName: c.courseName.trim(),
        departmentCode: input.departmentCode,
        courseType: c.courseType,
        year: input.year ?? null,
        credits: c.credits,
        maxIsa: c.maxIsa,
        maxMse: c.maxMse,
        maxEse: c.maxEse,
        maxTotal: c.maxTotal,
      })
      created++
    }

    await createAuditLog({
      action: "course.imported",
      actorId: user!.id,
      targetType: "department",
      targetId: input.departmentCode,
      details: { created, skipped, rejected: problems.length },
    })
    revalidatePath("/dashboard/dept/courses")

    // A partial import is still a success: the rows that were fine are in, and
    // the reviewer is told exactly which were not rather than losing the lot.
    return {
      error: problems.length > 0 ? problems.slice(0, 5).join("; ") : null,
      created,
      skipped,
    }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not import the courses") }
  }
}
