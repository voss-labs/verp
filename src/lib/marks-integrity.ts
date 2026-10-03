// What makes a mark writable, and a result publishable.
//
// Both rules were previously enforced only by the UI. A number input with a max
// is a courtesy to whoever is typing, not a guarantee — a crafted request wrote
// whatever it liked. And publication checked that components were *locked*,
// which says the teacher considers them finished, not that anybody was actually
// marked: a register with 89 blank rows could be locked and published, and the
// students behind it were shown a completed semester worth zero credits.
//
// Pure so the rules can be tested without a database, and so the same functions
// answer both "may this be written" and "may this be published".

import type { CourseInfo, MarksInput } from "@/lib/sgpi"

export type MarkRow = MarksInput & { studentId: string }

/** The component a value belongs to, and the maximum it may reach. */
export type Bound = { field: keyof MarksInput; label: string; max: number }

export function markBounds(course: CourseInfo): Bound[] {
  const b: Bound[] = [{ field: "isa", label: "ISA", max: course.maxIsa }]
  if (course.maxMse > 0) {
    b.push({ field: "mse1", label: "MSE 1", max: course.maxMse })
    b.push({ field: "mse2", label: "MSE 2", max: course.maxMse })
  }
  b.push({ field: "ese", label: "ESE", max: course.maxEse })
  return b
}

/**
 * Why a submitted row cannot be stored, or null if it can.
 *
 * A blank is always allowed — components are entered at different points in the
 * term, so "not yet" has to be expressible. Everything else must be a whole
 * number from zero to that component's maximum. A course with no MSE rejects an
 * MSE outright rather than storing a figure no calculation will ever read.
 */
export function invalidReason(
  row: MarksInput,
  course: CourseInfo
): string | null {
  const hasMse = course.maxMse > 0
  if (!hasMse && (row.mse1 != null || row.mse2 != null)) {
    return "This subject has no MSE component."
  }
  for (const b of markBounds(course)) {
    const v = row[b.field]
    if (v == null) continue
    if (!Number.isInteger(v)) return `${b.label} must be a whole number.`
    if (v < 0) return `${b.label} cannot be negative.`
    if (v > b.max) return `${b.label} cannot exceed ${b.max}.`
  }
  return null
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string; studentId: string }

/**
 * Validate a whole payload, rejecting all of it if any row is bad.
 *
 * Storing the good rows and dropping the rest would look like a successful save
 * to whoever pressed the button, and the marks that vanished would be found
 * later by the student they belonged to.
 */
export function validateMarks(
  rows: MarkRow[],
  course: CourseInfo
): ValidationResult {
  for (const row of rows) {
    const reason = invalidReason(row, course)
    if (reason) return { ok: false, reason, studentId: row.studentId }
  }
  return { ok: true }
}

export type Component = "isa" | "mse1" | "mse2" | "ese"

/** Resolve one import row against stored marks: a column absent from the file keeps its stored value, a locked component never moves, and a real zero is written. */
export function mergeMarks(
  previous: MarksInput | undefined,
  incoming: MarksInput,
  locked: Component[]
): MarksInput {
  const resolve = (field: keyof MarksInput, component: Component) => {
    if (locked.includes(component)) return previous?.[field] ?? null
    return incoming[field] ?? previous?.[field] ?? null
  }
  return {
    isa: resolve("isa", "isa"),
    mse1: resolve("mse1", "mse1"),
    mse2: resolve("mse2", "mse2"),
    ese: resolve("ese", "ese"),
  }
}

/** Whether one student's entry for a component is finished. */
function hasComponent(row: MarksInput | undefined, c: Component): boolean {
  if (!row) return false
  if (c === "isa") return row.isa != null
  if (c === "ese") return row.ese != null
  if (c === "mse1") return row.mse1 != null
  return row.mse2 != null
}

/** The components a course actually has. MSE1 and MSE2 are named separately —
 * they are submitted, locked, and published at different points, not as one
 * unit. */
export function requiredComponents(course: CourseInfo): Component[] {
  return course.maxMse > 0 ? ["isa", "mse1", "mse2", "ese"] : ["isa", "ese"]
}

export type Incomplete = { studentId: string; missing: Component[] }

/**
 * Students on the roster who are not finished for the given components.
 *
 * Keyed on the roster rather than on the marks table, which is the whole point:
 * counting rows in `marks` answers "how many students has somebody touched",
 * and the question that matters is "is anybody still unmarked". A student with
 * no row at all is the case that was being missed.
 */
export function incompleteStudents(
  roster: string[],
  marks: Map<string, MarksInput>,
  components: Component[]
): Incomplete[] {
  const out: Incomplete[] = []
  for (const studentId of roster) {
    const row = marks.get(studentId)
    const missing = components.filter((c) => !hasComponent(row, c))
    if (missing.length > 0) out.push({ studentId, missing })
  }
  return out
}

/** How many students on the roster are fully marked for every component. */
export function completeCount(
  roster: string[],
  marks: Map<string, MarksInput>,
  course: CourseInfo
): number {
  const required = requiredComponents(course)
  return roster.length - incompleteStudents(roster, marks, required).length
}

const LABEL: Record<Component, string> = {
  isa: "ISA",
  mse1: "MSE 1",
  mse2: "MSE 2",
  ese: "ESE",
}

/** A refusal a teacher can act on: how many, and what is missing. */
export function incompleteMessage(
  incomplete: Incomplete[],
  action: string
): string {
  const n = incomplete.length
  const missing = [...new Set(incomplete.flatMap((i) => i.missing))]
    .map((c) => LABEL[c])
    .join(", ")
  return `${n} student${n === 1 ? " has" : "s have"} no ${missing} mark yet. ${action} once every student on the roster is marked, or deactivate anyone who has left the class.`
}

/** Whether publishing may proceed: there has to be at least one locked component — something final to show. Which one doesn't matter; a subject can be published on MSE1 alone. */
export function isPublishable(locked: Component[]): boolean {
  return locked.length > 0
}

/**
 * Blank every component that isn't locked, so an unlocked figure never
 * reaches a student. A locked component's value passes through unchanged;
 * everything else reads exactly like a blank the teacher never typed —
 * computeMarks and marksState already treat that as not yet graded, so a
 * subject shows a grade only once every component is locked, and locking one
 * more component later shows up without a republish.
 */
export function maskUnlockedMarks(
  marks: MarksInput,
  locked: Component[]
): MarksInput {
  return {
    isa: locked.includes("isa") ? marks.isa : null,
    mse1: locked.includes("mse1") ? marks.mse1 : null,
    mse2: locked.includes("mse2") ? marks.mse2 : null,
    ese: locked.includes("ese") ? marks.ese : null,
  }
}
