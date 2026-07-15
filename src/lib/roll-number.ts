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
