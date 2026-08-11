import { describe, expect, it } from "vitest"
import {
  currentYear,
  expectedYear,
  isValidRollNumber,
  looksLikeRoll,
  parseRollNumber,
} from "./roll-number"
import { classKey, classKeyFromRoll, tryClassKeyFromRoll } from "./class-key"

describe("parseRollNumber", () => {
  it("splits a roll into year, branch, division and number", () => {
    const p = parseRollNumber("23108A0054")
    expect(p).toMatchObject({
      admissionYear: 2023,
      branchCode: "108",
      department: "EXCS",
      division: "A",
      classNumber: 54,
      isDSY: false,
    })
  })

  it("flags diploma entry from the 2000+ number block", () => {
    expect(parseRollNumber("23108A2001").isDSY).toBe(true)
    expect(parseRollNumber("23108A1999").isDSY).toBe(false)
  })

  it("accepts the legacy EXCS branch code", () => {
    expect(parseRollNumber("21103A0001").department).toBe("EXCS")
  })

  it("leaves an unknown branch unnamed rather than guessing", () => {
    expect(parseRollNumber("23999A0001").department).toBeNull()
  })

  it("rejects a division the branch does not run", () => {
    // EXCS is A/B only; IT runs a third.
    expect(() => parseRollNumber("23108C0001")).toThrow(/division C/)
    expect(parseRollNumber("23101C0001").department).toBe("IT")
  })

  it("rejects a malformed roll", () => {
    for (const bad of ["", "abc", "2310A0054", "23108A054", "23108A00541"]) {
      expect(isValidRollNumber(bad)).toBe(false)
    }
  })

  it("looksLikeRoll is structural only, so a bad division still looks like one", () => {
    expect(looksLikeRoll("23108C0001")).toBe(true)
    expect(isValidRollNumber("23108C0001")).toBe(false)
    expect(looksLikeRoll("Batch 1")).toBe(false)
  })
})

describe("expectedYear", () => {
  // The academic year turns over in June, so the same date sits in different
  // years depending on which side of the boundary it falls.
  it("advances the cohort in June, not January", () => {
    expect(expectedYear(2023, new Date("2026-05-31"))).toBe("TE")
    expect(expectedYear(2023, new Date("2026-06-01"))).toBe("BE")
  })

  it("walks FE through BE", () => {
    const on = new Date("2026-08-01")
    expect(expectedYear(2026, on)).toBe("FE")
    expect(expectedYear(2025, on)).toBe("SE")
    expect(expectedYear(2024, on)).toBe("TE")
    expect(expectedYear(2023, on)).toBe("BE")
  })

  it("returns null past the final year", () => {
    expect(expectedYear(2022, new Date("2026-08-01"))).toBeNull()
  })
})

describe("classKeyFromRoll", () => {
  it("keys a cohort by admission year, branch and division", () => {
    expect(classKey(2023, "108", "a")).toBe("2023-108-A")
    expect(classKeyFromRoll("23108A0054")).toBe("2023-108-A")
  })

  // A DSY student is admitted a year late but joins the cohort that started
  // the year before, so their key folds back.
  it("folds a diploma-entry roll back to its cohort's start year", () => {
    expect(classKeyFromRoll("24108A2001")).toBe("2023-108-A")
  })

  it("returns null rather than throwing for an unparseable roll", () => {
    expect(tryClassKeyFromRoll("nonsense")).toBeNull()
  })
})

describe("currentYear", () => {
  const on = new Date("2026-08-01")

  it("derives the year from the roll, ignoring a stale stored value", () => {
    expect(currentYear("24108A0004", "SE", on)).toBe("TE")
  })

  it("folds DSY back so they advance with their cohort", () => {
    expect(currentYear("24108A2001", "FE", on)).toBe("BE")
  })

  it("reports a graduated student as graduated, not as a year", () => {
    expect(currentYear("23108A0054", "BE", on, new Date("2026-06-01"))).toBe(
      "Graduated"
    )
  })

  it("falls back to the stored value when the roll will not parse", () => {
    expect(currentYear("junk", "TE", on)).toBe("TE")
  })

  it("falls back past BE, where there is no year left to compute", () => {
    expect(currentYear("21108A0001", "BE", on)).toBe("BE")
  })
})
