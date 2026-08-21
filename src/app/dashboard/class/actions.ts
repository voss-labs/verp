"use server"

import { revalidatePath } from "next/cache"
import { getSessionUser, type SessionUser } from "@/lib/session"
import { authorize } from "@/lib/rbac"
import { studentsInClass } from "@/lib/scope"
import {
  type Component,
  incompleteMessage,
  incompleteStudents,
  mergeMarks,
  requiredComponents,
  validateMarks,
} from "@/lib/marks-integrity"
import { canAllocate, canReopenLock, canWriteOffering } from "@/lib/allocation"
import { getErrorMessage } from "@/lib/error-utils"
import { parseRollNumber, expectedYear } from "@/lib/roll-number"
import { createAuditLog } from "@/db/queries"
import { createImportBatch } from "@/db/queries/import-batches"
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
  setOfferingPublished,
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
    // Admitting somebody to a class is governance, not teaching. Every teacher
    // assigned to the class held this, so any of them could admit a student to
    // a cohort they do not run.
    if (!canAllocate(user!, req.classId, cls.departmentCode)) {
      return {
        error:
          "Only the class coordinator, the HOD, or an admin can decide enrolment requests.",
      }
    }

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

    const { ok, cls } = await classInScope(user!, req.classId)
    if (!cls) return { error: "That class is not in your scope." }
    if (!canAllocate(user!, req.classId, cls.departmentCode)) {
      return {
        error:
          "Only the class coordinator, the HOD, or an admin can decide enrolment requests.",
      }
    }
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
  /** The subject this register is for. Null is a class-level session. */
  offeringId?: string | null
  marks: { studentId: string; status: AttStatus }[]
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "attendance:write")
    const { ok, cls } = await classInScope(user!, input.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }

    // Only students actually in this class can be marked. The whole request is
    // refused rather than the offending rows dropped: a partial write looks
    // successful, so a forged id would leave no trace and a genuine bug would
    // look like attendance that quietly went missing.
    const roster = new Set(
      (await getStudentsByClassKeys([cls.classKey])).map((s) => s.id)
    )
    const attScope = studentsInClass(
      roster,
      input.marks.map((m) => m.studentId)
    )
    if (!attScope.ok) return { error: attScope.reason }

    // A register named for a subject has to be a subject of this class,
    // otherwise the class scope check above is worked around by pointing at
    // another class's offering.
    const offeringId = input.offeringId ?? null
    if (offeringId) {
      const offering = await getOfferingById(offeringId)
      if (!offering || offering.classId !== input.classId)
        return { error: "That subject is not taught in this class." }
      // Belonging to the class is not enough. A subject register is that
      // teacher's record of their own lecture; a colleague filling it in is the
      // same mistake as entering their marks, and the same rule settles it.
      if (
        !canWriteOffering(
          user!,
          offering.facultyId,
          input.classId,
          cls.departmentCode
        )
      ) {
        return { error: "That subject is allocated to another teacher." }
      }
    }

    const entries = input.marks.map((m) => ({
      studentId: m.studentId,
      classId: input.classId,
      courseOfferingId: offeringId,
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
        offeringId,
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
  importFile?: { name: string; size?: number; totalRows?: number } | null
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "marks:write")
    const offering = await getOfferingById(input.offeringId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }

    const parsedRows = Math.max(
      input.importFile?.totalRows ?? input.rows.length,
      input.rows.length
    )
    const recordImport = (
      status: "committed" | "failed",
      counts: { inserted: number; updated: number },
      errorSummary: string | null
    ) =>
      input.importFile
        ? createImportBatch({
            kind: "marks",
            fileName: input.importFile.name,
            fileSize: input.importFile.size ?? null,
            rowCount: parsedRows,
            insertedCount: counts.inserted,
            updatedCount: counts.updated,
            skippedCount: parsedRows - counts.inserted - counts.updated,
            status,
            errorSummary,
            scopeLabel: cls.classKey,
            actorUserId: user!.id,
          })
        : Promise.resolve(null)

    const refuse = async (reason: string): Promise<Result> => {
      await recordImport("failed", { inserted: 0, updated: 0 }, reason)
      return { error: reason }
    }

    if (
      !canWriteOffering(
        user!,
        offering.facultyId,
        offering.classId,
        cls.departmentCode
      )
    ) {
      return refuse("That subject is allocated to another teacher.")
    }

    // A locked component is frozen for everyone, including whoever locked it.
    // Enforced here and not only in the UI: the grid is the polite reminder,
    // this is the actual guarantee — a stale tab or a direct call must not slip
    // a mark past a submitted component.
    // The caller's authority over the subject says nothing about WHOSE marks
    // the payload names. Without this, a teacher holding one class could attach
    // marks from their offering to a student in another — and getMarksForStudent
    // reads by student id alone, so it would surface in that student's record.
    const roster = new Set(
      (await getStudentsByClassKeys([cls.classKey])).map((s) => s.id)
    )
    const scope = studentsInClass(
      roster,
      input.rows.map((r) => r.studentId)
    )
    if (!scope.ok) return refuse(scope.reason)

    // The number inputs carry min/max, but that is a courtesy to whoever is
    // typing. This is the guarantee: a crafted request previously stored a
    // negative mark, or one above the component maximum, and every average
    // computed from it downstream was silently wrong.
    const valid = validateMarks(input.rows, offering.course)
    if (!valid.ok) return refuse(valid.reason)

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
    const previous =
      locked.length > 0 || input.importFile
        ? new Map(
            (await getMarksForOffering(input.offeringId)).map((m) => [
              m.studentId,
              m,
            ])
          )
        : null
    if (input.importFile && previous) {
      // An import maps only the columns the file carries, so a null here means
      // "not in this file" — keep what is stored rather than erasing it. The
      // grid always sends all four read back from the server, so its null is a
      // deliberate clear and keeps the replace path below.
      for (const r of rows) {
        const merged = mergeMarks(previous.get(r.studentId), r, locked)
        r.isa = merged.isa
        r.mse1 = merged.mse1
        r.mse2 = merged.mse2
        r.ese = merged.ese
      }
    } else if (locked.length > 0 && previous) {
      for (const r of rows) {
        const before = previous.get(r.studentId)
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
    const updatedCount = previous
      ? rows.filter((r) => previous.has(r.studentId)).length
      : 0
    await recordImport(
      "committed",
      { inserted: rows.length - updatedCount, updated: updatedCount },
      null
    )
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
/**
 * Roster-wide completeness for an offering.
 *
 * Asked of the roster, not of the marks table. Counting rows in `marks` answers
 * "how many students has somebody touched", and the question that decides
 * whether a result may be frozen or shown is "is anybody still unmarked".
 */
async function rosterIncomplete(
  offeringId: string,
  classKey: string,
  course: { maxIsa: number; maxMse: number; maxEse: number },
  components: Component[]
) {
  const [roster, existing] = await Promise.all([
    getStudentsByClassKeys([classKey]),
    getMarksForOffering(offeringId),
  ])
  const byStudent = new Map(existing.map((m) => [m.studentId, m]))
  return incompleteStudents(
    roster.map((r) => r.id),
    byStudent,
    components
  )
}

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

    // Freezing somebody else's subject is a write to it. This checked class
    // membership only, so any teacher on the class could submit a colleague's
    // marks on their behalf — the one thing locking is supposed to make
    // unambiguous.
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

    if (input.locked) {
      // Locking says "these figures are final". It cannot be true of a
      // component nobody has entered — and once locked, publication accepted
      // it, so a blank register reached students as a completed result.
      const missing = await rosterIncomplete(
        input.offeringId,
        cls.classKey,
        offering.course,
        [component]
      )
      if (missing.length > 0) {
        return { error: incompleteMessage(missing, "Lock") }
      }
    }

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

    // A batch belongs to one offering on one class, so its members must come
    // from that class. batch_assignments only checks that both rows exist, so
    // nothing below this would catch a student from another division.
    const cls2 = await getClassById(offering.classId)
    if (!cls2) return { error: "No such class." }
    const roster = new Set(
      (await getStudentsByClassKeys([cls2.classKey])).map((s) => s.id)
    )
    const scope = studentsInClass(roster, input.studentIds)
    if (!scope.ok) return { error: scope.reason }

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

    // The same roster check assignBatchAction makes. Adding a student was
    // guarded and removing one was not, which is the kind of asymmetry that
    // survives review because the reader checks the interesting direction.
    const roster = new Set(
      (await getStudentsByClassKeys([cls.classKey])).map((s) => s.id)
    )
    const scope = studentsInClass(roster, [input.studentId])
    if (!scope.ok) return { error: scope.reason }

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

/**
 * Publish a subject's results, or withdraw them.
 *
 * Every component the course actually has must be locked first. That is what
 * makes the sequence mean anything: locking is the teacher saying the figures
 * are final, publishing is the coordinator saying the student may see them. A
 * publish that skipped locking would collapse the two into one button and leave
 * "final" meaning nothing.
 *
 * A course with no MSE component is not asked to lock one.
 */
export async function setPublishedAction(input: {
  offeringId: string
  published: boolean
}): Promise<Result> {
  try {
    const user = await getSessionUser()
    authorize(user, "marks:lock")
    const offering = await getOfferingById(input.offeringId)
    if (!offering) return { error: "No such subject." }
    const { ok, cls } = await classInScope(user!, offering.classId)
    if (!ok || !cls) return { error: "That class is not in your scope." }
    // Publication is governance, not teaching: the coordinator, the HOD or an
    // admin decides, never the teacher acting alone on their own marks.
    if (!canAllocate(user!, offering.classId, cls.departmentCode)) {
      return {
        error:
          "Only the class coordinator, the HOD, or an admin can publish results.",
      }
    }

    if (input.published) {
      const required = requiredComponents(offering.course)
      const locked = (await getLockedComponents(input.offeringId)).map(
        (l) => l.component
      )
      const open = required.filter((c) => !locked.includes(c))
      if (open.length > 0) {
        return {
          error: `Lock ${open.join(", ").toUpperCase()} before publishing — publishing says these marks are final.`,
        }
      }

      // Checked again here rather than trusted from the locks. Locks predating
      // this rule exist — the live EC33T offering was locked and published over
      // an almost entirely blank register, and every student behind it was
      // shown a finished semester worth zero credits.
      const missing = await rosterIncomplete(
        input.offeringId,
        cls.classKey,
        offering.course,
        required
      )
      if (missing.length > 0) {
        return { error: incompleteMessage(missing, "Publish") }
      }
    }

    await setOfferingPublished(
      input.offeringId,
      user!.facultyId,
      input.published
    )
    await createAuditLog({
      action: input.published ? "marks.published" : "marks.withdrawn",
      actorId: user!.id,
      targetType: "offering",
      targetId: input.offeringId,
      details: { courseCode: offering.course.courseCode },
    })
    revalidatePath(`/dashboard/class/${offering.classId}/marks`)
    revalidatePath("/dashboard/my-marks")
    return { error: null }
  } catch (err) {
    return { error: getErrorMessage(err, "Could not change publication") }
  }
}
