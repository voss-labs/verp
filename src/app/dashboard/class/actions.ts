"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, type SessionUser } from "@/lib/session"
import { authorize } from "@/lib/rbac"
import { getErrorMessage } from "@/lib/error-utils"
import { parseRollNumber, expectedYear } from "@/lib/roll-number"
import { createAuditLog } from "@/db/queries"
import { getClassById } from "@/db/queries/classes"
import {
  createStudent,
  getStudentByRollNumber,
  getStudentsByClassIds,
} from "@/db/queries/students"
import { getRequestById, updateRequest } from "@/db/queries/onboarding"
import { upsertAttendance } from "@/db/queries/attendance"

type Result = { error: string | null }
type AttStatus = "present" | "absent" | "late" | "excused"

// A class is in scope if the caller coordinates/teaches it (classIds), is the HOD
// of its department, or is super_admin.
async function classInScope(user: SessionUser, classId: string) {
  const cls = await getClassById(classId)
  if (!cls) return { ok: false as const, cls: null }
  const ok =
    user.tier === "super_admin" ||
    user.classIds.includes(classId) ||
    (user.tier === "hod" && user.deptCodes.includes(cls.departmentCode))
  return { ok, cls }
}

export async function approveEnrollmentAction(input: {
  requestId: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "onboarding:approve")

    const req = await getRequestById(input.requestId)
    if (!req) return { error: "No such request." }
    if (req.status !== "pending")
      return { error: "This request is not pending." }
    if (!req.classId) return { error: "This request is not routed to a class." }

    const { ok, cls } = await classInScope(user!, req.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }

    if (await getStudentByRollNumber(req.rollNumber)) {
      await updateRequest(req.id, {
        status: "rejected",
        rejectionReason: "Roll number already registered",
        reviewedByFacultyId: user!.facultyId,
        reviewedAt: new Date(),
      })
      return { error: "That roll number is already registered." }
    }

    const parsed = parseRollNumber(req.rollNumber)
    const now = new Date()
    await createStudent({
      firstName: req.firstName,
      lastName: req.lastName,
      rollNumber: req.rollNumber,
      email: req.email,
      department: cls.departmentCode,
      division: parsed.division,
      year:
        expectedYear(parsed.admissionYear, now) ?? String(parsed.admissionYear),
      classId: cls.id,
      authUserId: req.authUserId,
    })
    await updateRequest(req.id, {
      status: "approved",
      reviewedByFacultyId: user!.facultyId,
      reviewedAt: now,
    })
    await createAuditLog({
      action: "enrollment.approved",
      actorId: user!.id,
      targetType: "enrollment_request",
      targetId: req.id,
      details: { rollNumber: req.rollNumber, classId: cls.id },
    })
    revalidatePath(`/dashboard/class/${req.classId}`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not approve") }
  }
}

export async function rejectEnrollmentAction(input: {
  requestId: string
  reason: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "onboarding:reject")

    const req = await getRequestById(input.requestId)
    if (!req) return { error: "No such request." }
    if (req.status !== "pending")
      return { error: "This request is not pending." }
    if (!req.classId) return { error: "This request is not routed to a class." }

    const { ok } = await classInScope(user!, req.classId)
    if (!ok) return { error: "That class is not in your scope." }

    const reason = input.reason.trim() || "Not recognised for this class"
    await updateRequest(req.id, {
      status: "rejected",
      rejectionReason: reason,
      reviewedByFacultyId: user!.facultyId,
      reviewedAt: new Date(),
    })
    await createAuditLog({
      action: "enrollment.rejected",
      actorId: user!.id,
      targetType: "enrollment_request",
      targetId: req.id,
      details: { rollNumber: req.rollNumber, reason },
    })
    revalidatePath(`/dashboard/class/${req.classId}`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not reject") }
  }
}

export async function saveAttendanceAction(input: {
  classId: string
  sessionDate: string
  sessionSlot: string
  marks: { studentId: string; status: AttStatus }[]
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "attendance:write")
    const { ok } = await classInScope(user!, input.classId)
    if (!ok) return { error: "That class is not in your scope." }

    // Only students actually in this class can be marked — a forged studentId is
    // dropped, not written.
    const roster = new Set(
      (await getStudentsByClassIds([input.classId])).map((s) => s.id)
    )
    const entries = input.marks
      .filter((m) => roster.has(m.studentId))
      .map((m) => ({
        studentId: m.studentId,
        classId: input.classId,
        sessionDate: input.sessionDate,
        sessionSlot: input.sessionSlot,
        status: m.status,
        recordedByFacultyId: user!.facultyId,
      }))
    await upsertAttendance(entries)

    await createAuditLog({
      action: "attendance.recorded",
      actorId: user!.id,
      targetType: "class",
      targetId: input.classId,
      details: {
        date: input.sessionDate,
        slot: input.sessionSlot,
        count: entries.length,
      },
    })
    revalidatePath(`/dashboard/class/${input.classId}/attendance`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not save attendance") }
  }
}
