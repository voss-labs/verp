import { describe, expect, it } from "vitest"
import {
  batchPlacesToRestore,
  emptyRosterMessage,
  hasRecordedMark,
  matchElectiveList,
  offeringRoster,
  rollsInSheet,
  rosterFrozenReason,
  sheetForSubject,
  studentsWithMarks,
  type BatchPlace,
} from "./electives"
import { incompleteStudents, type Component } from "./marks-integrity"
import type { MarksInput } from "./sgpi"

const ELECTIVE = { isElective: true }
const WHOLE_CLASS = { isElective: false }
const blank = { isa: null, mse1: null, mse2: null, ese: null }
const full = { isa: 15, mse1: 20, mse2: 22, ese: 40 }

describe("offeringRoster", () => {
  const cls = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]

  it("is the whole class for an ordinary subject", () => {
    const roster = offeringRoster(WHOLE_CLASS, cls, new Set(["a"]))
    expect(roster).toEqual(cls)
  })

  // The report this exists for: an elective's grid listed the whole division.
  it("is only the students put on it for an elective", () => {
    const roster = offeringRoster(ELECTIVE, cls, new Set(["b", "d"]))
    expect(roster.map((s) => s.id)).toEqual(["b", "d"])
  })

  it("keeps the class's roll order, not the order students were added in", () => {
    const roster = offeringRoster(ELECTIVE, cls, new Set(["d", "a"]))
    expect(roster.map((s) => s.id)).toEqual(["a", "d"])
  })

  // Narrowed, not replaced: an enrolment cannot reach past the class.
  it("drops somebody on the elective who is no longer in the class", () => {
    const roster = offeringRoster(ELECTIVE, cls, new Set(["a", "zzz"]))
    expect(roster.map((s) => s.id)).toEqual(["a"])
  })

  it("is empty for an elective nobody has been put on yet", () => {
    expect(offeringRoster(ELECTIVE, cls, new Set())).toEqual([])
  })

  it("narrows bare ids the same way it narrows rows", () => {
    const roster = offeringRoster(ELECTIVE, ["a", "b", "c"], new Set(["c"]))
    expect(roster).toEqual(["c"])
  })
})

// Why the roster had to change and not only the grid: completeness is what
// locking and publishing wait for.
describe("an elective's completeness", () => {
  const cls = ["a", "b", "c", "d"]
  const marks = new Map([
    ["a", full],
    ["b", full],
  ])
  const all: Component[] = ["isa", "mse", "ese"]

  it("is complete once everybody taking it is marked", () => {
    const roster = offeringRoster(ELECTIVE, cls, new Set(["a", "b"]))
    expect(incompleteStudents(roster, marks, all)).toEqual([])
  })

  it("could never be complete measured against the whole class", () => {
    expect(incompleteStudents(cls, marks, all)).toHaveLength(2)
  })

  // Why locking and publishing check for an empty roster on their own.
  it("reports nobody missing from an empty roster", () => {
    expect(incompleteStudents([], new Map(), all)).toEqual([])
  })
})

describe("hasRecordedMark", () => {
  it("is false for a row with nothing in it", () => {
    expect(hasRecordedMark(blank)).toBe(false)
  })

  it("is false for no row at all", () => {
    expect(hasRecordedMark(undefined)).toBe(false)
  })

  // Zero is a mark somebody entered, not the absence of one.
  it("counts a zero", () => {
    expect(hasRecordedMark({ ...blank, ese: 0 })).toBe(true)
  })

  it("counts any one component", () => {
    expect(hasRecordedMark({ ...blank, mse2: 12 })).toBe(true)
  })
})

describe("studentsWithMarks", () => {
  // The whole-class grid saves a row for every student it shows, marked or not.
  it("ignores the empty rows a whole-class grid leaves behind", () => {
    const marks = new Map<string, MarksInput>([
      ["a", full],
      ["b", blank],
      ["c", { ...blank, isa: 0 }],
    ])
    expect(studentsWithMarks(marks)).toEqual(["a", "c"])
  })

  it("is empty when nothing has been entered", () => {
    expect(studentsWithMarks(new Map())).toEqual([])
  })
})

describe("rosterFrozenReason", () => {
  const open = { published: false, locked: [] as Component[] }

  it("lets the roster change while nothing is locked or published", () => {
    expect(rosterFrozenReason(open)).toBeNull()
  })

  it("names the locked component and where to reopen it", () => {
    const reason = rosterFrozenReason({ ...open, locked: ["isa"] })
    expect(reason).toMatch(/^ISA is locked/)
    expect(reason).toContain("Marks tab")
  })

  it("names every locked component", () => {
    const reason = rosterFrozenReason({ ...open, locked: ["isa", "ese"] })
    expect(reason).toMatch(/^ISA, ESE are locked/)
  })

  // Reopening the locks does not unpublish: what students can see was checked
  // against the roster as it stood.
  it("stays frozen while the results are published, even with the locks reopened", () => {
    expect(rosterFrozenReason({ ...open, published: true })).toBe(
      "Its results are published. Withdraw them on the Marks tab before changing who takes it."
    )
  })

  // Publishing needs every component locked, so both usually hold at once.
  it("names the locks to reopen along with the results to withdraw", () => {
    const reason = rosterFrozenReason({
      published: true,
      locked: ["isa", "mse", "ese"],
    })
    expect(reason).toBe(
      "Its results are published. Withdraw them and reopen ISA, MSE, ESE on the Marks tab before changing who takes it."
    )
  })
})

describe("emptyRosterMessage", () => {
  // Who decides, not what to do next: the teacher who presses Lock cannot open
  // the Electives tab.
  it("names who puts students on an empty elective", () => {
    expect(emptyRosterMessage(true, "Lock")).toBe(
      "Nobody is taking this elective, so there is nothing to lock. The class coordinator adds its students on the Electives tab."
    )
    expect(emptyRosterMessage(true, "Publish")).toMatch(
      /^Nobody is taking this elective, so there is nothing to publish\./
    )
  })

  it("says plainly that an empty class has nothing to lock", () => {
    expect(emptyRosterMessage(false, "Lock")).toBe(
      "This class has no students yet, so there is nothing to lock."
    )
  })
})

describe("batchPlacesToRestore", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 8, 30, 9, minutes))
  const place = (
    id: string,
    studentId: string,
    minutes: number,
    extra: Partial<BatchPlace> = {}
  ): BatchPlace => ({
    id,
    studentId,
    isActive: false,
    batchActive: true,
    updatedAt: at(minutes),
    ...extra,
  })

  // A lab already split into batches is made an elective before anybody has a
  // mark, so everybody leaves its batches. The students then put on it go back
  // to the batch they were in, not to none.
  it("gives a student back the last place they held", () => {
    const places = [place("b1", "s", 0), place("b2", "s", 30)]
    expect(batchPlacesToRestore(places)).toEqual(["b2"])
  })

  it("leaves a student already in a batch where they are", () => {
    const places = [
      place("b1", "s", 30),
      place("b2", "s", 0, { isActive: true }),
    ]
    expect(batchPlacesToRestore(places)).toEqual([])
  })

  it("gives back nothing when their last batch no longer runs", () => {
    const places = [
      place("b1", "s", 0),
      place("b2", "s", 30, { batchActive: false }),
    ]
    expect(batchPlacesToRestore(places)).toEqual([])
  })

  it("decides for each student on their own", () => {
    const places = [
      place("a1", "a", 10),
      place("b1", "b", 20),
      place("b2", "b", 0, { isActive: true }),
    ]
    expect(batchPlacesToRestore(places)).toEqual(["a1"])
  })
})

describe("rollsInSheet", () => {
  // Whatever shape the form that collected the choices left behind.
  it("finds the roll numbers wherever they sit, once each, in sheet order", () => {
    const grid = [
      ["Students who chose Cloud Computing"],
      ["Roll No", "Name"],
      ["23108A0012", "Neha"],
      ["", "23108a 0003", "Omkar"],
      ["23108A0012", "Neha again"],
      ["CLASS", "BE EXCS A"],
    ]
    expect(rollsInSheet(grid)).toEqual(["23108A0012", "23108A0003"])
  })

  it("is empty for a sheet with no roll numbers on it", () => {
    expect(rollsInSheet([["Instructions"], ["Fill in the form"]])).toEqual([])
  })
})

describe("matchElectiveList", () => {
  const cls = [
    { id: "a", rollNumber: "23108A0001" },
    { id: "b", rollNumber: "23108A0002" },
    { id: "c", rollNumber: "23108A0003" },
  ]

  it("sorts a list into who it adds, who is on already, and who the class lacks", () => {
    const res = matchElectiveList(
      ["23108A0003", "23108B0009", "23108A0001"],
      cls,
      new Set(["a"])
    )
    expect(res.add.map((s) => s.id)).toEqual(["c"])
    expect(res.already.map((s) => s.id)).toEqual(["a"])
    expect(res.notInClass).toEqual(["23108B0009"])
  })

  it("lists the students in the class's roll order, not the sheet's", () => {
    const res = matchElectiveList(["23108A0003", "23108A0001"], cls, new Set())
    expect(res.add.map((s) => s.id)).toEqual(["a", "c"])
  })
})

describe("sheetForSubject", () => {
  // A workbook with a tab per elective opens on this subject's tab.
  it("finds the tab named for the subject", () => {
    expect(
      sheetForSubject(["Instructions", "ec37t cloud", "EC38T"], "EC37T")
    ).toBe("ec37t cloud")
  })

  it("is null when no tab names it", () => {
    expect(sheetForSubject(["Sheet1"], "EC37T")).toBeNull()
  })
})
