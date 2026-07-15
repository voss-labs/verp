"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, type SessionUser } from "@/lib/session"
import { authorize } from "@/lib/rbac"
import { getErrorMessage } from "@/lib/error-utils"
import { classKey, tryClassKeyFromRoll } from "@/lib/class-key"
import { BRANCH_CODE_BY_DEPT, divisionsForBranch } from "@/lib/roll-number"
import { createAuditLog } from "@/db/queries"
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
