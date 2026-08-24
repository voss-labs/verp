"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser } from "@/lib/session"
import { inDeptScope } from "@/lib/allocation"
import { authorize, can, ROLE_DEFAULTS } from "@/lib/rbac"
import { isCapability, isFacultyRole, isManageableTier } from "@/lib/validate"
import { getErrorMessage, isUniqueViolation } from "@/lib/error-utils"
import { createAuditLog } from "@/db/queries"
import { setRoleOverride } from "@/db/queries/permissions"
import {
  createDepartment,
  setDepartmentActive,
  getDepartment,
} from "@/db/queries/departments"
import {
  createFaculty,
  updateFaculty,
  deactivateFaculty,
  getFacultyByEmail,
  getFacultyByEmailIncludingInactive,
  getFacultyById,
  linkFacultyToAuthUser,
} from "@/db/queries/faculty"
import {
  getStaffRequestById,
  updateStaffRequestStatus,
} from "@/db/queries/staff-requests"
import { getStudentByAuthUserId } from "@/db/queries/students"
import {
  appointHod,
  appointCoordinator,
  getActiveHod,
} from "@/db/queries/appointments"

type Result = { error: string | null }

const CODE_RE = /^[A-Z]{2,10}$/

export async function createDepartmentAction(input: {
  code: string
  name: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "dept:create")

    const code = input.code.toUpperCase().trim()
    const name = input.name.trim()
    if (!CODE_RE.test(code)) return { error: "Code must be 2–10 letters." }
    if (!name) return { error: "Name is required." }
    if (await getDepartment(code))
      return { error: `Department ${code} already exists.` }

    await createDepartment({ code, name })
    await createAuditLog({
      action: "department.created",
      actorId: user!.id,
      targetType: "department",
      targetId: code,
      details: { name },
    })
    revalidatePath("/dashboard/admin/departments")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not create department") }
  }
}

export async function setDepartmentActiveAction(input: {
  code: string
  isActive: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, input.isActive ? "dept:update" : "dept:deactivate")
    const row = await setDepartmentActive(input.code, input.isActive)
    if (!row) return { error: "No such department." }
    await createAuditLog({
      action: input.isActive ? "department.enabled" : "department.disabled",
      actorId: user!.id,
      targetType: "department",
      targetId: input.code,
    })
    revalidatePath("/dashboard/admin/departments")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not update department") }
  }
}

// ── Faculty ─────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export async function createFacultyAction(input: {
  firstName: string
  lastName: string
  employeeId: string
  email: string
  department: string
  role: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:create")

    const email = input.email.trim().toLowerCase()
    if (!input.firstName.trim()) return { error: "First name is required." }
    if (!input.employeeId.trim()) return { error: "Employee ID is required." }
    if (!EMAIL_RE.test(email)) return { error: "A valid email is required." }
    if (!input.department) return { error: "Department is required." }
    if (!isFacultyRole(input.role) || input.role === "super_admin")
      return { error: "Choose a valid role." }
    if (input.role !== "faculty" && !can(user, "faculty:setRole"))
      return { error: "You cannot create faculty above the faculty tier." }
    // faculty:create is an HOD default and the department comes from the
    // payload, so without this an HOD could add staff to a department that is
    // not theirs. The department workspace already checked; the console did not.
    if (!inDeptScope(user!, input.department)) {
      return { error: "That department is not yours to add faculty to." }
    }
    if (await getFacultyByEmail(email))
      return { error: `A faculty with ${email} already exists.` }

    const row = await createFaculty({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      employeeId: input.employeeId.trim(),
      email,
      department: input.department,
      role: input.role,
    })
    await createAuditLog({
      action: "faculty.created",
      actorId: user!.id,
      targetType: "faculty",
      targetId: row.id,
      details: { email, department: input.department, role: input.role },
    })
    revalidatePath("/dashboard/admin/faculty")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not add faculty") }
  }
}

export async function setFacultyRoleAction(input: {
  facultyId: string
  role: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:setRole")
    if (!isFacultyRole(input.role) || input.role === "super_admin")
      return { error: "Choose a valid role." }

    const target = await getFacultyById(input.facultyId)
    if (!target) return { error: "No such faculty." }
    if (!inDeptScope(user!, target.department))
      return { error: "That faculty member is in another department." }
    if (target.id === user!.facultyId)
      return { error: "You cannot change your own tier." }

    const row = await updateFaculty(input.facultyId, { role: input.role })
    if (!row) return { error: "No such faculty." }
    await createAuditLog({
      action: "faculty.role_changed",
      actorId: user!.id,
      targetType: "faculty",
      targetId: input.facultyId,
      details: { role: input.role },
    })
    revalidatePath("/dashboard/admin/faculty")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not change tier") }
  }
}

export async function deactivateFacultyAction(input: {
  facultyId: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:update")
    // Scoped on the row's OWN department — the id is the whole payload here, so
    // there is nothing caller-supplied to trust. faculty:update is an HOD
    // default, so unscoped this deactivated anyone in the college, another
    // department's HOD included.
    const target = await getFacultyById(input.facultyId)
    if (!target) return { error: "No such faculty member." }
    if (!inDeptScope(user!, target.department)) {
      return { error: "That faculty member is in another department." }
    }
    await deactivateFaculty(input.facultyId)
    await createAuditLog({
      action: "faculty.deactivated",
      actorId: user!.id,
      targetType: "faculty",
      targetId: input.facultyId,
    })
    revalidatePath("/dashboard/admin/faculty")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not deactivate faculty") }
  }
}

export async function approveStaffRequestAction(input: {
  requestId: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:create")

    const req = await getStaffRequestById(input.requestId)
    if (!req) return { error: "No such request." }
    if (req.status !== "pending")
      return { error: "This request has already been decided." }
    if (!inDeptScope(user!, req.deptCode))
      return { error: "That department is not in your scope." }
    if (await getStudentByAuthUserId(req.authUserId))
      return {
        error: `${req.email} has since been registered as a student. Reject this request.`,
      }

    const existing = await getFacultyByEmailIncludingInactive(req.email)
    if (existing?.authUserId && existing.authUserId !== req.authUserId)
      return { error: `${req.email} is linked to a different VOSS account.` }

    let facultyId: string
    if (existing) {
      if (!inDeptScope(user!, existing.department))
        return {
          error: `${req.email} is already on the roster in ${existing.department}. Only that department can confirm them.`,
        }
      if (!existing.isActive)
        await updateFaculty(existing.id, { isActive: true })
      if (!existing.authUserId)
        await linkFacultyToAuthUser(existing.id, req.authUserId)
      facultyId = existing.id
    } else {
      const created = await createFaculty({
        firstName: req.firstName,
        lastName: req.lastName,
        employeeId: req.employeeId,
        email: req.email,
        department: req.deptCode,
        role: "faculty",
        authUserId: req.authUserId,
      }).catch((err) => {
        if (isUniqueViolation(err)) return null
        throw err
      })
      if (!created)
        return {
          error: `Could not add them — Employee ID ${req.employeeId} or ${req.email} is already on the roster.`,
        }
      facultyId = created.id
    }

    await updateStaffRequestStatus(req.id, {
      status: "approved",
      reviewedByFacultyId: user!.facultyId,
    })
    await createAuditLog({
      action: "staff_request.approved",
      actorId: user!.id,
      targetType: "staff_request",
      targetId: req.id,
      details: {
        facultyId,
        employeeId: req.employeeId,
        deptCode: req.deptCode,
        email: req.email,
      },
    })
    revalidatePath("/dashboard/admin/faculty")
    revalidatePath("/dashboard/dept")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not approve") }
  }
}

export async function rejectStaffRequestAction(input: {
  requestId: string
  reason: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:create")

    const req = await getStaffRequestById(input.requestId)
    if (!req) return { error: "No such request." }
    if (req.status !== "pending")
      return { error: "This request has already been decided." }
    if (!inDeptScope(user!, req.deptCode))
      return { error: "That department is not in your scope." }

    const reason = input.reason.trim() || "Not recognised by this department"
    await updateStaffRequestStatus(req.id, {
      status: "rejected",
      rejectionReason: reason,
      reviewedByFacultyId: user!.facultyId,
    })
    await createAuditLog({
      action: "staff_request.rejected",
      actorId: user!.id,
      targetType: "staff_request",
      targetId: req.id,
      details: {
        employeeId: req.employeeId,
        deptCode: req.deptCode,
        email: req.email,
        reason,
      },
    })
    revalidatePath("/dashboard/admin/faculty")
    revalidatePath("/dashboard/dept")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not reject") }
  }
}

export async function appointHodAction(input: {
  deptCode: string
  facultyId: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "hod:appoint")

    const dept = await getDepartment(input.deptCode)
    if (!dept) return { error: "No such department." }
    if (!inDeptScope(user!, dept.code))
      return { error: "That department is not yours to appoint in." }
    if (!dept.isActive)
      return { error: `${dept.code} is inactive. Reactivate it first.` }

    const target = await getFacultyById(input.facultyId)
    if (!target) return { error: "No such active faculty member." }
    if (target.role === "super_admin")
      return { error: "A super-admin cannot be appointed HOD." }

    const current = await getActiveHod(dept.code)
    if (current?.facultyId === target.id)
      return { error: `${target.firstName} already heads ${dept.code}.` }

    await appointHod(dept.code, target.id, user!.facultyId)
    await createAuditLog({
      action: "dept.hod_appointed",
      actorId: user!.id,
      targetType: "department",
      targetId: dept.code,
      details: {
        facultyId: target.id,
        employeeId: target.employeeId,
        replacedFacultyId: current?.facultyId ?? null,
      },
    })
    revalidatePath("/dashboard/admin/departments")
    revalidatePath("/dashboard/dept")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not appoint an HOD") }
  }
}

export async function appointCoordinatorAction(input: {
  deptCode: string
  facultyId: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "hod:appoint")

    if (!inDeptScope(user!, input.deptCode))
      return { error: "That department is not yours to appoint in." }

    const target = await getFacultyById(input.facultyId)
    if (!target) return { error: "No such active faculty member." }
    if (target.department !== input.deptCode)
      return { error: "That faculty member is in another department." }

    await appointCoordinator(input.deptCode, input.facultyId, user!.facultyId)
    await createAuditLog({
      action: "dept.coordinator_appointed",
      actorId: user!.id,
      targetType: "department",
      targetId: input.deptCode,
      details: { facultyId: input.facultyId },
    })
    revalidatePath("/dashboard/admin/faculty")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not appoint") }
  }
}

// ── Roles & permissions ─────────────────────────────────────────────────

export async function setRoleCapabilityAction(input: {
  tier: string
  capability: string
  enabled: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "permission:manage")
    if (!isManageableTier(input.tier) || !isCapability(input.capability))
      return { error: "Unknown role or capability." }

    // Store an override only when the wish diverges from the code default;
    // matching the default clears any override (back to baseline).
    const isDefault = ROLE_DEFAULTS[input.tier].includes(input.capability)
    const effect =
      input.enabled === isDefault ? null : input.enabled ? "grant" : "deny"

    await setRoleOverride(input.tier, input.capability, effect, user!.id)
    await createAuditLog({
      action: "permission.override_set",
      actorId: user!.id,
      targetType: "role",
      targetId: input.tier,
      details: {
        capability: input.capability,
        effect: effect ?? "default",
      },
    })
    revalidatePath("/dashboard/admin/roles")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not update permission") }
  }
}
