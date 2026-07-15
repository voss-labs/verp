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
}

// Divisions per branch. Only IT and CMPN run a third (C) division; every other
// branch is A/B. This is the rule VERP's old enum(["A","B"]) got wrong.
const DIVISIONS_BY_BRANCH: Record<string, readonly string[]> = {
  "101": ["A", "B", "C"], // IT
  "102": ["A", "B", "C"], // CMPN
  "104": ["A", "B"], // EXTC
  "105": ["A", "B"], // BIOMED
  "108": ["A", "B"], // EXCS
}

export const ALL_DIVISIONS = ["A", "B", "C"] as const
export type Division = (typeof ALL_DIVISIONS)[number]

// FE/SE/TE/BE, derived from how many years since admission.
const YEAR_BY_LEVEL = ["FE", "SE", "TE", "BE"] as const
export type Year = (typeof YEAR_BY_LEVEL)[number]

export type ParsedRoll = {
  admissionYear: number
  branchCode: string
  department: string
  division: Division
  classNumber: number
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
    throw new Error(`"${raw}" is not a valid roll number (expected e.g. 23108A0054)`)
  }
  const [, yy, branchCode, division, num] = m

  const department = BRANCH_CODES[branchCode]
  if (!department) {
    throw new Error(`Unknown branch code "${branchCode}" in ${roll}`)
  }

  const allowed = DIVISIONS_BY_BRANCH[branchCode]
  if (!allowed.includes(division)) {
    throw new Error(`${department} has no division ${division} (${roll})`)
  }

  return {
    admissionYear: 2000 + Number(yy),
    branchCode,
    department,
    division: division as Division,
    classNumber: Number(num),
  }
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
  const acadYearStart = on.getMonth() >= 5 ? on.getFullYear() : on.getFullYear() - 1
  const level = acadYearStart - admissionYear // 0..3
  return YEAR_BY_LEVEL[level] ?? null
}
