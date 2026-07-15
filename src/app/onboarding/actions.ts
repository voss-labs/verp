"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser } from "@/lib/session"
import { getErrorMessage } from "@/lib/error-utils"
import { parseRollNumber } from "@/lib/roll-number"
import { classKeyFromRoll } from "@/lib/class-key"
import { createAuditLog } from "@/db/queries"
import { getStudentByRollNumber } from "@/db/queries/students"
import { getClassByKey } from "@/db/queries/classes"
import {
  getLatestRequestForUser,
  createEnrollmentRequest,
} from "@/db/queries/onboarding"

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
