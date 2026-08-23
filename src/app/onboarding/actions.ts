"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, isUnbound } from "@/lib/session"
import { getErrorMessage, isUniqueViolation } from "@/lib/error-utils"
import { parseRollNumber } from "@/lib/roll-number"
import { classKeyFromRoll } from "@/lib/class-key"
import { createAuditLog } from "@/db/queries"
import { getStudentByRollNumber } from "@/db/queries/students"
import { getClassByKey } from "@/db/queries/classes"
import { getDepartment } from "@/db/queries/departments"
import { getFacultyByEmail } from "@/db/queries/faculty"
import {
  getLatestRequestForUser,
  createEnrollmentRequest,
  deleteOwnEnrollmentRequest,
} from "@/db/queries/onboarding"
import {
  createStaffRequest,
  deleteOwnStaffRequest,
  getLatestStaffRequestForUser,
} from "@/db/queries/staff-requests"

type Result = { error: string | null }

// A student claims their identity. The email is NOT taken from the form — it is
// the VOSS-verified session email, the only un-forgeable fact. The roll number is
// parsed and routed to the class's coordinator; approval is where trust is applied.
export async function submitEnrollmentRequestAction(input: {
  rollNumber: string
  firstName: string
  lastName: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    if (!user) return { error: "Please sign in again." }
    if (user.tier !== null) return { error: "Your account is already set up." }

    const roll = input.rollNumber.trim().toUpperCase()
    const firstName = input.firstName.trim()
    if (!firstName) return { error: "First name is required." }

    try {
      parseRollNumber(roll)
    } catch (e) {
      return { error: getErrorMessage(e, "That roll number is not valid.") }
    }

    if (await getStudentByRollNumber(roll))
      return { error: "That roll number is already registered." }

    const latest = await getLatestRequestForUser(user.id)
    if (latest && (latest.status === "pending" || latest.status === "unrouted"))
      return { error: "You already have a request in review." }

    const staff = await getLatestStaffRequestForUser(user.id)
    if (staff?.status === "pending")
      return {
        error:
          "You have a staff request in review. Withdraw it before claiming a roll number.",
      }

    const key = classKeyFromRoll(roll)
    const cls = await getClassByKey(key)

    await createEnrollmentRequest({
      authUserId: user.id,
      rollNumber: roll,
      firstName,
      lastName: input.lastName.trim(),
      email: user.email,
      classId: cls?.id ?? null,
      status: cls ? "pending" : "unrouted",
    })
    await createAuditLog({
      action: "enrollment.requested",
      actorId: user.id,
      targetType: "enrollment_request",
      targetId: roll,
      details: { classKey: key, routed: !!cls },
    })
    revalidatePath("/unclaimed")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not submit your request") }
  }
}

export async function withdrawEnrollmentRequestAction(): Promise<Result> {
  try {
    const user = await getSessionUser()
    if (!user) return { error: "Please sign in again." }
    if (user.tier !== null) return { error: "Your account is already set up." }

    const req = await getLatestRequestForUser(user.id)
    if (!req || (req.status !== "pending" && req.status !== "unrouted"))
      return { error: "There is no request to withdraw." }

    const removed = await deleteOwnEnrollmentRequest(req.id, user.id)
    if (!removed) return { error: "That request is not yours to withdraw." }

    await createAuditLog({
      action: "enrollment.withdrawn",
      actorId: user.id,
      targetType: "enrollment_request",
      targetId: req.id,
      details: {
        rollNumber: req.rollNumber,
        classId: req.classId,
        status: req.status,
      },
    })
    revalidatePath("/unclaimed")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not withdraw your request") }
  }
}

export async function submitStaffRequestAction(input: {
  firstName: string
  lastName: string
  employeeId: string
  deptCode: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    if (!user) return { error: "Please sign in again." }
    if (!isUnbound(user)) return { error: "Your account is already set up." }

    const firstName = input.firstName.trim()
    const employeeId = input.employeeId.trim()
    const deptCode = input.deptCode.trim().toUpperCase()
    if (!firstName) return { error: "First name is required." }
    if (!employeeId) return { error: "Employee ID is required." }

    const dept = await getDepartment(deptCode)
    if (!dept || !dept.isActive)
      return { error: "Choose the department you work in." }

    const email = user.email.trim().toLowerCase()
    if (await getFacultyByEmail(email))
      return {
        error:
          "You are already on the staff roster. Sign in again and you will be placed.",
      }

    const enrolment = await getLatestRequestForUser(user.id)
    if (
      enrolment &&
      (enrolment.status === "pending" || enrolment.status === "unrouted")
    )
      return {
        error:
          "You already have a student request in review. Withdraw it before asking as staff.",
      }

    const latest = await getLatestStaffRequestForUser(user.id)
    if (latest?.status === "pending")
      return { error: "You already have a request in review." }

    const request = await createStaffRequest({
      authUserId: user.id,
      firstName,
      lastName: input.lastName.trim(),
      email,
      employeeId,
      deptCode,
    }).catch((err) => {
      if (isUniqueViolation(err)) return null
      throw err
    })
    if (!request) return { error: "You already have a request in review." }

    await createAuditLog({
      action: "staff_request.submitted",
      actorId: user.id,
      targetType: "staff_request",
      targetId: request.id,
      details: { employeeId, deptCode, email },
    })
    revalidatePath("/unclaimed")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not submit your request") }
  }
}

export async function withdrawStaffRequestAction(): Promise<Result> {
  try {
    const user = await getSessionUser()
    if (!user) return { error: "Please sign in again." }
    if (!isUnbound(user)) return { error: "Your account is already set up." }

    const req = await getLatestStaffRequestForUser(user.id)
    if (!req || req.status !== "pending")
      return { error: "There is no request to withdraw." }

    const removed = await deleteOwnStaffRequest(req.id, user.id)
    if (!removed) return { error: "That request is not yours to withdraw." }

    await createAuditLog({
      action: "staff_request.withdrawn",
      actorId: user.id,
      targetType: "staff_request",
      targetId: req.id,
      details: {
        employeeId: req.employeeId,
        deptCode: req.deptCode,
        status: req.status,
      },
    })
    revalidatePath("/unclaimed")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not withdraw your request") }
  }
}
