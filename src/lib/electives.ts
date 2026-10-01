// Electives: subjects taught to part of a class.
//
// A class's roster is derived, never stored — its students are the ones whose
// roll number resolves to its class key. That is exactly right for a subject
// the whole division sits, and wrong for an elective: the division splits
// across several of them, and each is taught to the students who chose it.
// Measured against the class, an elective's marks grid listed everybody, and it
// could never be locked or published — locking waits for a mark from every
// student on the roster, and most of the class would never have one.
//
// Pure, so the rules can be tested without a database, and so every surface
// that asks "who is this subject taught to" gets one answer.

import type { MarksInput } from "@/lib/sgpi"
import type { Component } from "@/lib/marks-integrity"
import { looksLikeRoll } from "@/lib/roll-number"

const idOf = (s: string | { id: string }) => (typeof s === "string" ? s : s.id)

/**
 * The students a subject is taught to.
 *
 * The class for an ordinary subject. For an elective, the class narrowed to the
 * students put on it — narrowed, not replaced, so somebody who leaves the class
 * or is deactivated drops off the elective the way they drop off everything
 * else, and no enrolment can reach a student outside the class.
 */
export function offeringRoster<T extends string | { id: string }>(
  offering: { isElective: boolean },
  classRoster: readonly T[],
  enrolled: ReadonlySet<string>
): T[] {
  if (!offering.isElective) return [...classRoster]
  return classRoster.filter((s) => enrolled.has(idOf(s)))
}

/** Whether anything is recorded for a student in a subject, as opposed to a row existing. */
export function hasRecordedMark(row: MarksInput | undefined): boolean {
  if (!row) return false
  return (
    row.isa != null || row.mse1 != null || row.mse2 != null || row.ese != null
  )
}

/**
 * The students with at least one mark recorded in a subject.
 *
 * A row is not evidence: the grid saves every row it shows, so a subject taught
 * as whole-class has a row for everybody in the division. A value is — it is a
 * teacher marking that student in that subject.
 */
export function studentsWithMarks(
  marks: ReadonlyMap<string, MarksInput>
): string[] {
  return [...marks]
    .filter(([, row]) => hasRecordedMark(row))
    .map(([studentId]) => studentId)
}

const LABEL: Record<Component, string> = {
  isa: "ISA",
  mse: "MSE",
  ese: "ESE",
}

/**
 * Why a subject's roster cannot change right now, or null if it can.
 *
 * Published results were checked against the roster as it stood, and a locked
 * component says every student on the roster has that mark. Changing who takes
 * the subject under either would make that untrue while it still reads as
 * finished, so the roster stays put until the results are withdrawn and the
 * locks reopened. Reopening the locks alone does not unpublish.
 */
export function rosterFrozenReason(subject: {
  published: boolean
  locked: Component[]
}): string | null {
  const names = subject.locked.map((c) => LABEL[c]).join(", ")
  if (subject.published) {
    // Publishing needs every component locked, so the locks are usually still
    // on too. Naming them here saves a second refusal after the withdrawal.
    const reopen = names ? ` and reopen ${names}` : ""
    return `Its results are published. Withdraw them${reopen} on the Marks tab before changing who takes it.`
  }
  if (subject.locked.length === 0) return null
  const one = subject.locked.length === 1
  return `${names} ${one ? "is" : "are"} locked for this subject. Reopen ${one ? "it" : "them"} on the Marks tab before changing who takes it.`
}

/**
 * Why a subject with nobody on its roster cannot be locked or published.
 *
 * "Every student has this mark" is true of an empty list without anybody
 * having marked anything. That let an elective nobody had been put on yet be
 * locked and published — a result for nobody, behind a lock that then froze its
 * roster empty.
 *
 * It says who decides the roster rather than what to do next. The teacher who
 * presses Lock cannot open the Electives tab, and a coordinator who meets this
 * while publishing has locks to reopen first, which that tab tells them.
 */
export function emptyRosterMessage(
  isElective: boolean,
  action: "Lock" | "Publish"
): string {
  const verb = action.toLowerCase()
  return isElective
    ? `Nobody is taking this elective, so there is nothing to ${verb}. The class coordinator adds its students on the Electives tab.`
    : `This class has no students yet, so there is nothing to ${verb}.`
}

/** A student's place in one of a subject's lab batches, live or switched off. */
export type BatchPlace = {
  id: string
  studentId: string
  isActive: boolean
  /** Whether the batch itself still runs. */
  batchActive: boolean
  updatedAt: Date
}

/**
 * The batch places to give back to students who take a subject again.
 *
 * A lab's batches hold only the students taking it, so a student leaves them
 * when they come off an elective, or are not on it when a lab already split
 * into batches becomes one. The place is switched off rather than deleted: the
 * split is the teacher's work, and the student may well be put back. Taking
 * the subject again gives back the last place they held, if that batch still
 * runs. Anybody already in one of its batches stays where they are.
 */
export function batchPlacesToRestore(places: readonly BatchPlace[]): string[] {
  const placed = new Set(
    places.filter((p) => p.isActive).map((p) => p.studentId)
  )
  const last = new Map<string, BatchPlace>()
  for (const p of places) {
    if (placed.has(p.studentId)) continue
    const seen = last.get(p.studentId)
    if (!seen || p.updatedAt > seen.updatedAt) last.set(p.studentId, p)
  }
  return [...last.values()].filter((p) => p.batchActive).map((p) => p.id)
}

/**
 * The roll numbers in a sheet, in the order they first appear. Any cell shaped
 * like a roll counts, wherever it sits, so a list arrives in whatever shape the
 * form that collected it left: a title row, a header, a name beside each roll.
 */
export function rollsInSheet(
  grid: readonly (readonly (string | undefined)[])[]
): string[] {
  const rolls = new Set<string>()
  for (const row of grid) {
    for (const cell of row) {
      const roll = (cell ?? "").replace(/\s/g, "").toUpperCase()
      if (looksLikeRoll(roll)) rolls.add(roll)
    }
  }
  return [...rolls]
}

/**
 * An imported list sorted against the class: who it would add, who is on the
 * elective already, and the roll numbers the class does not have (another
 * division, or a typo), which are reported and never added. The students come
 * back in the class's roll order, like both lists on the Electives tab.
 */
export function matchElectiveList<T extends { id: string; rollNumber: string }>(
  rolls: readonly string[],
  classRoster: readonly T[],
  members: ReadonlySet<string>
): { add: T[]; already: T[]; notInClass: string[] } {
  const listed = new Set(rolls)
  const found = new Set<string>()
  const add: T[] = []
  const already: T[] = []
  for (const student of classRoster) {
    const roll = student.rollNumber.toUpperCase()
    if (!listed.has(roll)) continue
    found.add(roll)
    if (members.has(student.id)) already.push(student)
    else add.push(student)
  }
  return { add, already, notInClass: rolls.filter((r) => !found.has(r)) }
}

/**
 * The tab of a workbook that holds one subject's list, when a tab is named for
 * it ("EC37T", "EC37T Cloud Computing"). Null when none is.
 */
export function sheetForSubject(
  sheetNames: readonly string[],
  courseCode: string
): string | null {
  const squash = (s: string) => s.replace(/\s/g, "").toUpperCase()
  const code = squash(courseCode)
  return sheetNames.find((name) => squash(name).includes(code)) ?? null
}
