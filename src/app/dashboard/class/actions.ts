"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, type SessionUser } from "@/lib/session"
import { authorize } from "@/lib/rbac"
import { canAllocate, canReopenLock, canWriteOffering } from "@/lib/allocation"
import { getErrorMessage } from "@/lib/error-utils"
import { parseRollNumber, expectedYear } from "@/lib/roll-number"
import { createAuditLog } from "@/db/queries"
import { getClassById } from "@/db/queries/classes"
import { listClassStaff } from "@/db/queries/class-staff"
import {
  createStudent,
  getStudentByRollNumber,
  getStudentsByClassKeys,
} from "@/db/queries/students"
import { getRequestById, updateRequest } from "@/db/queries/onboarding"
import { upsertAttendance } from "@/db/queries/attendance"
import { getCourseByCode, createCourse } from "@/db/queries/courses"
import {
  createOffering,
  getOfferingById,
  setOfferingFaculty,
} from "@/db/queries/offerings"
import {
  createBatch,
  getBatchById,
  assignStudentsToBatch,
  removeStudentFromBatch,
} from "@/db/queries/batches"
import {
  upsertMarks,
  getMarksForOffering,
  getLockedComponents,
  setMarksLock,
  isLockComponent,
  type LockComponent,
} from "@/db/queries/marks"

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
      classKey: cls.classKey,
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
    const { ok, cls } = await classInScope(user!, input.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }

    // Only students actually in this class can be marked — a forged studentId is
    // dropped, not written.
    const roster = new Set(
      (await getStudentsByClassKeys([cls.classKey])).map((s) => s.id)
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

export async function createSubjectAction(input: {
  classId: string
  courseCode: string
  courseName: string
  courseType: "theory" | "practical" | "project"
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  semester: number
  /** The TR who will teach it. Null leaves the subject unallocated. */
  facultyId?: string | null
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    // offering:create, not marks:write. An HOD allocates subjects and never
    // enters marks, so gating this on marks:write shut out the one role the
    // scope check below was written to admit.
    authorize(user, "offering:create")
    const { ok, cls } = await classInScope(user!, input.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }
    if (!canAllocate(user!, input.classId, cls.departmentCode)) {
      return {
        error:
          "Only the class coordinator, the HOD, or an admin can add a subject.",
      }
    }
    if (!input.courseCode.trim() || !input.courseName.trim())
      return { error: "Course code and name are required." }

    // Reuse the course if it already exists (a subject is taught to many classes),
    // else create it under this class's department.
    let course = await getCourseByCode(input.courseCode)
    if (!course) {
      course = await createCourse({
        courseCode: input.courseCode,
        courseName: input.courseName.trim(),
        departmentCode: cls.departmentCode,
        courseType: input.courseType,
        credits: input.credits,
        maxIsa: input.maxIsa,
        maxMse: input.maxMse,
        maxEse: input.maxEse,
        maxTotal: input.maxTotal,
      })
    }
    await createOffering({
      courseId: course.id,
      classId: input.classId,
      // Whoever will TEACH it, not whoever typed it in. Defaulting to the
      // creator quietly made every subject belong to the coordinator.
      facultyId: input.facultyId ?? null,
      semester: input.semester,
    })
    await createAuditLog({
      action: "offering.created",
      actorId: user!.id,
      targetType: "class",
      targetId: input.classId,
      details: { courseCode: input.courseCode },
    })
    revalidatePath(`/dashboard/class/${input.classId}/marks`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not add subject") }
  }
}

export async function saveMarksAction(input: {
  offeringId: string
  rows: {
    studentId: string
    isa: number | null
    mse1: number | null
    mse2: number | null
    ese: number | null
  }[]
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "marks:write")
    const offering = await getOfferingById(input.offeringId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }
    if (
      !canWriteOffering(
        user!,
        offering.facultyId,
        offering.classId,
        cls.departmentCode
      )
    ) {
      return { error: "That subject is allocated to another teacher." }
    }

    // A locked component is frozen for everyone, including whoever locked it.
    // Enforced here and not only in the UI: the grid is the polite reminder,
    // this is the actual guarantee — a stale tab or a direct call must not slip
    // a mark past a submitted component.
    const lockRows = await getLockedComponents(input.offeringId)
    const locked = lockRows.map((l) => l.component)
    const rows = input.rows.map((r) => ({
      courseOfferingId: input.offeringId,
      studentId: r.studentId,
      isa: r.isa,
      mse1: r.mse1,
      mse2: r.mse2,
      ese: r.ese,
      recordedByFacultyId: user!.facultyId,
    }))
    if (locked.length > 0) {
      const existing = await getMarksForOffering(input.offeringId)
      const prev = new Map(existing.map((m) => [m.studentId, m]))
      for (const r of rows) {
        const before = prev.get(r.studentId)
        // Carry the stored value forward for every locked component, so an edit
        // to an open one cannot drag a frozen figure along with it.
        if (locked.includes("isa")) r.isa = before?.isa ?? null
        if (locked.includes("mse")) {
          r.mse1 = before?.mse1 ?? null
          r.mse2 = before?.mse2 ?? null
        }
        if (locked.includes("ese")) r.ese = before?.ese ?? null
      }
    }

    await upsertMarks(rows)
    await createAuditLog({
      action: "marks.recorded",
      actorId: user!.id,
      targetType: "offering",
      targetId: input.offeringId,
      details: { count: input.rows.length },
    })
    revalidatePath(`/dashboard/class/${offering.classId}/marks`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not save marks") }
  }
}

/**
 * Freeze or reopen one marks component.
 *
 * Locking and unlocking are deliberately not the same privilege. Anyone who can
 * enter marks can freeze them — that is just the person who finished the work
 * saying so. Reopening is the class coordinator's call (or an HOD's, or a
 * super-admin's), because it undoes a submission somebody else may already have
 * acted on. A TR who spots a typo asks the coordinator; that conversation is the
 * point, not an obstacle.
 */
export async function setMarksLockAction(input: {
  offeringId: string
  component: string
  locked: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "marks:lock")
    if (!isLockComponent(input.component)) {
      return { error: "Unknown marks component." }
    }
    const component: LockComponent = input.component

    const offering = await getOfferingById(input.offeringId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }

    if (!input.locked) {
      const held = (await getLockedComponents(input.offeringId)).find(
        (l) => l.component === component
      )
      if (
        !canReopenLock(
          user!,
          offering.classId,
          cls.departmentCode,
          held?.lockedByFacultyId ?? null
        )
      ) {
        return {
          error:
            "Only the teacher who locked this, the class coordinator, or the HOD can reopen it.",
        }
      }
    }

    await setMarksLock({
      courseOfferingId: input.offeringId,
      component,
      locked: input.locked,
      facultyId: user!.facultyId,
    })
    await createAuditLog({
      action: input.locked ? "marks.locked" : "marks.unlocked",
      actorId: user!.id,
      targetType: "offering",
      targetId: input.offeringId,
      details: { component, courseCode: offering.course.courseCode },
    })
    revalidatePath(`/dashboard/class/${offering.classId}/marks`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not change the lock") }
  }
}

/** Reopening is coordinator-and-above; teaching the class is not enough. */

// ── practical batches ──────────────────────────────────────────────────────

export async function createBatchAction(input: {
  offeringId: string
  name: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "marks:write")
    const offering = await getOfferingById(input.offeringId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }
    // A batch belongs to one offering, so it is the teacher's to arrange for
    // exactly the same reason its marks are.
    if (
      !canWriteOffering(
        user!,
        offering.facultyId,
        offering.classId,
        cls.departmentCode
      )
    ) {
      return { error: "That subject is allocated to another teacher." }
    }
    const name = input.name.trim().toUpperCase()
    if (!name) return { error: "A batch name is required." }

    await createBatch({ courseOfferingId: input.offeringId, name })
    await createAuditLog({
      action: "batch.created",
      actorId: user!.id,
      targetType: "offering",
      targetId: input.offeringId,
      details: { name, courseCode: offering.course.courseCode },
    })
    revalidatePath(`/dashboard/class/${offering.classId}/batches`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not create the batch") }
  }
}

export async function assignBatchAction(input: {
  batchId: string
  studentIds: string[]
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "marks:write")
    const batch = await getBatchById(input.batchId)
    if (!batch) return { error: "No such batch." }
    const offering = await getOfferingById(batch.courseOfferingId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }
    if (
      !canWriteOffering(
        user!,
        offering.facultyId,
        offering.classId,
        cls.departmentCode
      )
    ) {
      return { error: "That subject is allocated to another teacher." }
    }

    await assignStudentsToBatch({
      batchId: input.batchId,
      courseOfferingId: batch.courseOfferingId,
      studentIds: input.studentIds,
    })
    await createAuditLog({
      action: "batch.assigned",
      actorId: user!.id,
      targetType: "offering",
      targetId: batch.courseOfferingId,
      details: { batch: batch.name, count: input.studentIds.length },
    })
    revalidatePath(`/dashboard/class/${offering.classId}/batches`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not assign the batch") }
  }
}

export async function removeFromBatchAction(input: {
  batchId: string
  studentId: string
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "marks:write")
    const batch = await getBatchById(input.batchId)
    if (!batch) return { error: "No such batch." }
    const offering = await getOfferingById(batch.courseOfferingId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }
    if (
      !canWriteOffering(
        user!,
        offering.facultyId,
        offering.classId,
        cls.departmentCode
      )
    ) {
      return { error: "That subject is allocated to another teacher." }
    }

    await removeStudentFromBatch(input)
    revalidatePath(`/dashboard/class/${offering.classId}/batches`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not remove the student") }
  }
}

/**
 * Hand a subject to a different teacher, or leave it unallocated.
 *
 * Marks already recorded are untouched: each row carries its own
 * recordedByFacultyId, so the history of who entered what survives a
 * reallocation. Only responsibility for what comes next moves.
 */
export async function assignOfferingFacultyAction(input: {
  offeringId: string
  facultyId: string | null
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "offering:update")
    const offering = await getOfferingById(input.offeringId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }
    if (!canAllocate(user!, offering.classId, cls.departmentCode)) {
      return {
        error:
          "Only the class coordinator, the HOD, or an admin can reallocate a subject.",
      }
    }

    if (input.facultyId) {
      // The teacher must actually be on this class. Allocating a subject to
      // somebody with no assignment would hand them a class they cannot open.
      const staff = await listClassStaff([offering.classId])
      if (!staff.some((s) => s.facultyId === input.facultyId)) {
        return { error: "That teacher is not assigned to this class." }
      }
    }

    await setOfferingFaculty(input.offeringId, input.facultyId)
    await createAuditLog({
      action: input.facultyId ? "offering.allocated" : "offering.unallocated",
      actorId: user!.id,
      targetType: "offering",
      targetId: input.offeringId,
      details: {
        courseCode: offering.course.courseCode,
        facultyId: input.facultyId,
      },
    })
    revalidatePath(`/dashboard/class/${offering.classId}/marks`)
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not reallocate the subject") }
  }
}
