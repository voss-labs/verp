"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser } from "@/lib/session"
import { inDeptScope } from "@/lib/allocation"
import {
  authorize,
  ROLE_DEFAULTS,
  type Capability,
  type Tier,
} from "@/lib/rbac"
import { getErrorMessage } from "@/lib/error-utils"
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
  getFacultyById,
} from "@/db/queries/faculty"
import { appointHod, appointCoordinator } from "@/db/queries/appointments"

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
  role: "faculty" | "hod"
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:create")

    const email = input.email.trim().toLowerCase()
    if (!input.firstName.trim()) return { error: "First name is required." }
    if (!input.employeeId.trim()) return { error: "Employee ID is required." }
    if (!EMAIL_RE.test(email)) return { error: "A valid email is required." }
    if (!input.department) return { error: "Department is required." }
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
  role: "faculty" | "hod"
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "faculty:setRole")
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

export async function appointAction(input: {
  deptCode: string
  facultyId: string
  appointment: "hod" | "coordinator"
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "hod:appoint")
    if (input.appointment === "hod") {
      await appointHod(input.deptCode, input.facultyId, user!.facultyId)
    } else {
      await appointCoordinator(input.deptCode, input.facultyId, user!.facultyId)
    }
    await createAuditLog({
      action: `dept.${input.appointment}_appointed`,
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

type ToggleTier = Exclude<Tier, "super_admin">

export async function setRoleCapabilityAction(input: {
  tier: ToggleTier
  capability: Capability
  enabled: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "permission:manage")

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
