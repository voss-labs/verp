// The scoped-write boundary.
//
// Every academic write names rows the caller did not necessarily choose: a
// marks payload carries student ids, an import carries roll numbers. Checking
// that the CALLER may act on the class is not enough — the payload must also
// only name students who belong to it. Without that, a teacher legitimately
// holding one class can attach marks, lab batches or roster rows to students in
// another.
//
// Rejecting the whole request beats silently dropping the offending ids.
// Dropping produces a partial write that looks successful, so a forged payload
// leaves no trace and a genuine bug looks like data that quietly went missing.

import { classKeyFromRoll } from "@/lib/class-key"
import { BRANCH_CODES } from "@/lib/roll-number"

export type ScopeResult =
  | { ok: true }
  | { ok: false; reason: string; offending: string[] }

/**
 * Every id must belong to the class. `roster` is the set of student ids derived
 * from the class key, which is the only definition of membership VERP has.
 */
export function studentsInClass(
  roster: Set<string>,
  studentIds: string[]
): ScopeResult {
  const offending = [...new Set(studentIds)].filter((id) => !roster.has(id))
  if (offending.length === 0) return { ok: true }
  return {
    ok: false,
    reason:
      offending.length === 1
        ? "One of the students is not in this class."
        : `${offending.length} of the students are not in this class.`,
    offending,
  }
}

/** Every id must sit in the batch being marked, not merely in its class. */
export function studentsInBatch(
  members: Set<string>,
  studentIds: string[]
): ScopeResult {
  const offending = [...new Set(studentIds)].filter((id) => !members.has(id))
  if (offending.length === 0) return { ok: true }
  return {
    ok: false,
    reason:
      offending.length === 1
        ? "One of the students is not in this batch."
        : `${offending.length} of the students are not in this batch.`,
    offending,
  }
}

/** Every id must already have an untagged row in the session being corrected. */
export function studentsInPreBatchRegister(
  recorded: Set<string>,
  studentIds: string[]
): ScopeResult {
  const offending = [...new Set(studentIds)].filter((id) => !recorded.has(id))
  if (offending.length === 0) return { ok: true }
  return {
    ok: false,
    reason:
      offending.length === 1
        ? "One of the students was not marked in this session before the lab was split."
        : `${offending.length} of the students were not marked in this session before the lab was split.`,
    offending,
  }
}

export type ImportActor = {
  tier: "super_admin" | "hod" | "faculty" | "student" | null
  deptCodes: string[]
  classKeys: string[]
}

/**
 * Which roll numbers this person may create or update.
 *
 * The roll is the authority, not the department and division typed alongside
 * it: those are descriptive columns a forged payload controls, while the roll
 * encodes the cohort and cannot disagree with itself. Anything that will not
 * parse is rejected rather than admitted unscoped.
 */
export function rollsInScope(
  user: ImportActor,
  rollNumbers: string[],
  /**
   * roll -> the class_key already stored for that student, where one exists.
   *
   * The roll usually derives its own cohort, but not always: a repeater is
   * admitted a year early and carries an explicit override, which the schema
   * calls out as the one case the roll cannot express. Judging such a student
   * only by their roll would put them outside the very class they sit in, and
   * refuse their own teacher's import. Where a stored key exists it is the
   * authority; the derived key is the fallback for someone new.
   */
  storedKeys: ReadonlyMap<string, string | null> = new Map()
): ScopeResult {
  if (user.tier === "super_admin") return { ok: true }
  if (user.tier !== "hod" && user.tier !== "faculty") {
    return { ok: false, reason: "You cannot import students.", offending: [] }
  }

  const offending: string[] = []
  for (const roll of rollNumbers) {
    const stored = storedKeys.get(roll.trim().toUpperCase())
    let key: string
    if (stored) {
      key = stored
    } else {
      try {
        key = classKeyFromRoll(roll)
      } catch {
        offending.push(roll)
        continue
      }
    }
    if (user.tier === "faculty") {
      // A TR may only import into the classes they hold.
      if (!user.classKeys.includes(key)) offending.push(roll)
      continue
    }
    // An HOD owns a department, so the branch inside the key decides. Read via
    // BRANCH_CODES rather than the forward map: it also carries the legacy EXCS
    // code 103, and an old cohort's roll must not fall outside its own HOD.
    const branch = key.split("-")[1]
    const dept = branch ? BRANCH_CODES[branch] : undefined
    if (!dept || !user.deptCodes.includes(dept)) offending.push(roll)
  }

  if (offending.length === 0) return { ok: true }
  return {
    ok: false,
    reason: `${offending.length} roll number${offending.length === 1 ? " is" : "s are"} outside your scope.`,
    offending: offending.slice(0, 10),
  }
}
