import { describe, expect, it } from "vitest"
import {
  completeCount,
  incompleteStudents,
  invalidReason,
  requiredComponents,
  validateMarks,
} from "./marks-integrity"
import type { CourseInfo, MarksInput } from "./sgpi"

const theory: CourseInfo = {
  courseType: "theory",
  credits: 4,
  maxIsa: 20,
  maxMse: 30,
  maxEse: 50,
  maxTotal: 100,
}
const practical: CourseInfo = { ...theory, maxMse: 0, maxIsa: 50, maxEse: 50 }
const blank: MarksInput = { isa: null, mse1: null, mse2: null, ese: null }

describe("invalidReason", () => {
  it("accepts a blank row — components arrive at different points in the term", () => {
    expect(invalidReason(blank, theory)).toBeNull()
  })

  it("accepts a mark at exactly the maximum", () => {
    expect(invalidReason({ ...blank, isa: 20 }, theory)).toBeNull()
  })

  // Zero is a score somebody earned, not an absence.
  it("accepts zero", () => {
    expect(invalidReason({ ...blank, isa: 0 }, theory)).toBeNull()
  })

  it("rejects a mark above the component maximum", () => {
    expect(invalidReason({ ...blank, isa: 21 }, theory)).toBe(
      "ISA cannot exceed 20."
    )
  })

  it("rejects a negative mark", () => {
    expect(invalidReason({ ...blank, ese: -1 }, theory)).toBe(
      "ESE cannot be negative."
    )
  })

  it("rejects a fractional mark", () => {
    expect(invalidReason({ ...blank, isa: 12.5 }, theory)).toBe(
      "ISA must be a whole number."
    )
  })

  // Storing it would put a figure in the table that no calculation reads.
  it("rejects an MSE on a subject that has none", () => {
    expect(invalidReason({ ...blank, mse1: 10 }, practical)).toBe(
      "This subject has no MSE component."
    )
  })

  it("bounds each MSE by the per-MSE maximum, not their sum", () => {
    expect(invalidReason({ ...blank, mse1: 30, mse2: 30 }, theory)).toBeNull()
    expect(invalidReason({ ...blank, mse2: 31 }, theory)).toBe(
      "MSE 2 cannot exceed 30."
    )
  })
})

describe("validateMarks", () => {
  it("rejects the whole payload when one row is bad", () => {
    const res = validateMarks(
      [
        { studentId: "a", ...blank, isa: 18 },
        { studentId: "b", ...blank, isa: 999 },
        { studentId: "c", ...blank, isa: 15 },
      ],
      theory
    )
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.studentId).toBe("b")
      expect(res.reason).toBe("ISA cannot exceed 20.")
    }
  })

  it("passes a payload where every row is in range", () => {
    expect(
      validateMarks(
        [
          { studentId: "a", isa: 18, mse1: 25, mse2: 27, ese: 40 },
          { studentId: "b", ...blank },
        ],
        theory
      ).ok
    ).toBe(true)
  })
})

describe("incompleteStudents", () => {
  const roster = ["a", "b", "c"]

  // The bug this exists to stop: an offering with no marks at all was locked
  // and published, and the students behind it saw a finished semester worth
  // nothing.
  it("reports every student when nobody has been marked", () => {
    const res = incompleteStudents(roster, new Map(), ["isa", "mse", "ese"])
    expect(res).toHaveLength(3)
    expect(res[0].missing).toEqual(["isa", "mse", "ese"])
  })

  it("counts a student with no row at all as missing, not absent from the list", () => {
    const marks = new Map([["a", { isa: 18, mse1: 25, mse2: 27, ese: 40 }]])
    expect(
      incompleteStudents(roster, marks, ["isa"]).map((i) => i.studentId)
    ).toEqual(["b", "c"])
  })

  it("treats one MSE of two as unfinished", () => {
    const marks = new Map([["a", { ...blank, mse1: 25 }]])
    expect(incompleteStudents(["a"], marks, ["mse"])[0].missing).toEqual([
      "mse",
    ])
  })

  it("is satisfied by both MSEs", () => {
    const marks = new Map([["a", { ...blank, mse1: 25, mse2: 27 }]])
    expect(incompleteStudents(["a"], marks, ["mse"])).toEqual([])
  })

  it("treats a zero as marked", () => {
    const marks = new Map([["a", { ...blank, isa: 0 }]])
    expect(incompleteStudents(["a"], marks, ["isa"])).toEqual([])
  })

  it("only asks about the components named", () => {
    const marks = new Map([["a", { ...blank, isa: 18 }]])
    expect(incompleteStudents(["a"], marks, ["isa"])).toEqual([])
    expect(incompleteStudents(["a"], marks, ["ese"])).toHaveLength(1)
  })

  // An empty class cannot block its own publication.
  it("says nothing about an empty roster", () => {
    expect(incompleteStudents([], new Map(), ["isa"])).toEqual([])
  })
})

describe("requiredComponents", () => {
  it("does not ask a practical for an MSE it does not have", () => {
    expect(requiredComponents(practical)).toEqual(["isa", "ese"])
    expect(requiredComponents(theory)).toEqual(["isa", "mse", "ese"])
  })
})

describe("completeCount", () => {
  // What the dashboard should have been counting. Counting rows in `marks`
  // reported 89 of 89 entered for a register that was almost entirely blank.
  it("counts fully marked students, not rows touched", () => {
    const roster = ["a", "b", "c"]
    const marks = new Map<string, MarksInput>([
      ["a", { isa: 18, mse1: 25, mse2: 27, ese: 40 }],
      ["b", { ...blank, isa: 12 }],
      ["c", blank],
    ])
    expect(completeCount(roster, marks, theory)).toBe(1)
  })
})
