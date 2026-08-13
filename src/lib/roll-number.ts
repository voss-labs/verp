// VIT roll numbers are self-describing composite keys, e.g. 23108A0054:
//   23   -> admitted 2023
//   108  -> branch (EXCS)
//   A    -> division
//   0054 -> number within the class
//
// This is why we parse rather than store branch/division separately: they live
// inside the roll number already, so a separate column could only ever drift
// from it. The importer parses the roll number and cross-checks it against the
// sheet's own Department/Division columns — a mismatch is a TR typo to flag.

export const BRANCH_CODES: Record<string, string> = {
  "101": "IT",
  "102": "CMPN",
  "104": "EXTC",
  "105": "BIOMED",
  "108": "EXCS",
  "103": "EXCS", // legacy EXCS code, old-curriculum batches (pre-108)
}

// Divisions per branch. Only IT and CMPN run a third (C) division; every other
// branch is A/B. This is the rule VERP's old enum(["A","B"]) got wrong.
const DIVISIONS_BY_BRANCH: Record<string, readonly string[]> = {
  "101": ["A", "B", "C"], // IT
  "102": ["A", "B", "C"], // CMPN
  "104": ["A", "B"], // EXTC
  "105": ["A", "B"], // BIOMED
  "108": ["A", "B"], // EXCS
  "103": ["A", "B"], // legacy EXCS
}

export const ALL_DIVISIONS = ["A", "B", "C"] as const
export type Division = (typeof ALL_DIVISIONS)[number]

// The numeric branch code a NEW class uses for each department (the current
// curriculum code — legacy 103 is not used for new cohorts). Inverse of
// BRANCH_CODES, minus the legacy alias.
export const BRANCH_CODE_BY_DEPT: Record<string, string> = {
  IT: "101",
  CMPN: "102",
  EXTC: "104",
  BIOMED: "105",
  EXCS: "108",
}

/** Divisions a branch runs (A/B, plus C for IT and CMPN). Defaults to A/B. */
export function divisionsForBranch(branchCode: string): readonly string[] {
  return DIVISIONS_BY_BRANCH[branchCode] ?? ["A", "B"]
}

// FE/SE/TE/BE, derived from how many years since admission.
const YEAR_BY_LEVEL = ["FE", "SE", "TE", "BE"] as const
export type Year = (typeof YEAR_BY_LEVEL)[number]

export type ParsedRoll = {
  admissionYear: number
  branchCode: string
  department: string | null
  division: Division
  classNumber: number
  isDSY: boolean
}

const ROLL_RE = /^(\d{2})(\d{3})([A-C])(\d{4})$/

/**
 * Parse and validate a roll number. Throws with a specific reason so the
 * importer can show the TR exactly what is wrong.
 */
export function parseRollNumber(raw: string): ParsedRoll {
  const roll = raw.trim().toUpperCase()
  const m = ROLL_RE.exec(roll)
  if (!m) {
    throw new Error(
      `"${raw}" is not a valid roll number (expected e.g. 23108A0054)`
    )
  }
  const [, yy, branchCode, division, num] = m

  // Unknown branch code is not an error: VERP may be used college-wide and this
  // map only covers the CS-family departments. Structurally-valid but unknown ->
  // department null, and the TR fills it in the preview. Only malformed rolls
  // (wrong shape) are rejected above.
  const department = BRANCH_CODES[branchCode] ?? null

  // Division rules only apply to branches we know. For an unknown branch, any
  // A-C is accepted rather than guessed at.
  const allowed = DIVISIONS_BY_BRANCH[branchCode]
  if (allowed && !allowed.includes(division)) {
    throw new Error(`${department} has no division ${division} (${roll})`)
  }

  return {
    admissionYear: 2000 + Number(yy),
    branchCode,
    department,
    division: division as Division,
    classNumber: Number(num),
    // Direct-Second-Year (diploma entry): class numbers in the 2000+ range.
    isDSY: Number(num) >= 2000,
  }
}

// Loose structural test: 2+3 digits, a division letter, 4 digits. Unlike
// parseRollNumber it does not check branch/division rules, so a structurally
// well-formed roll with a wrong division still "looks like" a roll — it is kept
// in the import and flagged, not silently dropped as junk. Used to tell a real
// student row from a separator/label ("Batch 1", a title) during import.
const LOOSE_ROLL_RE = /^\d{5}[A-Z]\d{4}$/
export function looksLikeRoll(raw: string): boolean {
  return LOOSE_ROLL_RE.test(raw.replace(/\s/g, "").toUpperCase())
}

/** True if the roll number parses cleanly. */
export function isValidRollNumber(raw: string): boolean {
  try {
    parseRollNumber(raw)
    return true
  } catch {
    return false
  }
}

/**
 * The academic year (FE/SE/TE/BE) a student SHOULD be in, given their admission
 * year and the current date. A mismatch with the sheet's Year column is a
 * signal (repeated a year, or a stale sheet), not necessarily an error.
 */
export function expectedYear(admissionYear: number, on: Date): Year | null {
  // The academic year rolls over mid-year; treat June as the boundary.
  const acadYearStart =
    on.getMonth() >= 5 ? on.getFullYear() : on.getFullYear() - 1
  const level = acadYearStart - admissionYear // 0..3
  return YEAR_BY_LEVEL[level] ?? null
}

/**
 * The year a student is in *now*, derived from their roll number.
 *
 * students.year is written once at import and never revisited, so it silently
 * rots: on 2026-08-11 more than half the live roster still carried the year it
 * was imported with, the 2024 cohort reading SE when it had reached TE. Class
 * labels never had this problem because they compute expectedYear on every
 * render — this is the same treatment for the student rows.
 *
 * It is deliberately the same argument this file opens with: branch and division
 * are parsed rather than stored because a copy can only ever drift from the roll
 * number. Year is no different, it just drifts on a timer instead of on a typo.
 *
 * Falls back to the stored value for a roll that will not parse, and for a
 * cohort past BE — a graduated student has no current year to compute.
 */
export function currentYear(
  rollNumber: string,
  storedYear: string,
  on: Date = new Date(),
  graduatedAt?: Date | null
): string {
  // A finished cohort has no current year to compute, and expectedYear returns
  // null past BE — without this they would read as a raw admission year, which
  // is indistinguishable from a roll that failed to parse.
  if (graduatedAt) return "Graduated"
  try {
    const { admissionYear, isDSY } = parseRollNumber(rollNumber)
    // A DSY student skips FE: they enter one year later but sit with the cohort
    // that started the year before, so the cohort's start year is what counts.
    const cohortYear = isDSY ? admissionYear - 1 : admissionYear
    return expectedYear(cohortYear, on) ?? storedYear
  } catch {
    return storedYear
  }
}

/**
 * The two semesters a programme year covers.
 *
 * A BE student sits semesters 7 and 8; putting their subject in "Semester 1"
 * is not a small display slip, it files the result under a year they finished
 * three years ago. The subject form defaulted to 1 because that was the lowest
 * number, not because anything derived it.
 */
export function semestersForYear(year: string): [number, number] | null {
  switch (year) {
    case "FE":
      return [1, 2]
    case "SE":
      return [3, 4]
    case "TE":
      return [5, 6]
    case "BE":
      return [7, 8]
    default:
      return null
  }
}

/** The semesters a class can plausibly be taught, given when it was admitted. */
export function semestersForClass(
  admissionYear: number,
  on: Date = new Date()
): [number, number] | null {
  const year = expectedYear(admissionYear, on)
  return year ? semestersForYear(year) : null
}
