import { parseRollNumber } from "@/lib/roll-number"

/**
 * A class key is the stable cohort identity built from a roll number's prefix:
 * "2023-108-A" = admitted 2023, branch 108, division A. It deliberately omits the
 * FE/SE/TE/BE label (which drifts every July) so a student's class membership
 * never changes as the cohort advances. This is the single value that both a
 * class row and a self-registering roll resolve to — the join needs no matching.
 */
export function classKey(
  admissionYear: number,
  branchCode: string,
  division: string
): string {
  return `${admissionYear}-${branchCode}-${division.toUpperCase()}`
}

/**
 * Resolve a roll number to its class key. Throws if the roll is malformed.
 *
 * A class is a cohort keyed by the year the batch STARTED (FE). A direct-second-
 * year student is admitted one year later (they skip FE) but joins that same
 * cohort, so their roll's admission year is one ahead of the cohort — we subtract
 * it back. Regular rolls map straight through. Repeaters (admitted a year early,
 * no roll marker) are the one case this can't derive: they get an explicit
 * class_key override on their student row.
 */
export function classKeyFromRoll(roll: string): string {
  const p = parseRollNumber(roll)
  const cohortYear = p.isDSY ? p.admissionYear - 1 : p.admissionYear
  return classKey(cohortYear, p.branchCode, p.division)
}

/** Non-throwing variant: returns null for a roll that does not parse. */
export function tryClassKeyFromRoll(roll: string): string | null {
  try {
    return classKeyFromRoll(roll)
  } catch {
    return null
  }
}
