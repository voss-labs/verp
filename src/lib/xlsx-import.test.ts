import { describe, expect, it } from "vitest"
import {
  editRows,
  flagRow,
  rollNeedsDepartment,
  type RosterFields,
} from "./xlsx-import"

const blank: RosterFields = {
  rollNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  department: "",
  division: "",
  year: "",
  semester: "",
  phoneNo: "",
}

const student = (rollNumber: string, patch: Partial<RosterFields> = {}) =>
  flagRow({ ...blank, rollNumber, firstName: "Asha", ...patch })

describe("editRows", () => {
  // What the bulk bar is for: a sheet whose tab name carries no year leaves
  // every row flagged, and each one used to be fixed by typing into its cell.
  it("sets a year on every picked row and clears the flag it raised", () => {
    const rows = ["23108A0001", "23108A0002", "23108A0003"].map((r) =>
      student(r)
    )
    expect(rows.every((r) => r.flags.some((f) => f.field === "year"))).toBe(
      true
    )
    const picked = new Set(["23108A0001", "23108A0002"])
    const next = editRows(rows, (r) => picked.has(r.rollNumber), {
      year: "TE",
    })
    expect(next.map((r) => r.year)).toEqual(["TE", "TE", ""])
    expect(next[0].flags).toEqual([])
    expect(next[2].flags.map((f) => f.field)).toEqual(["year"])
  })

  // The claim the bulk bar rests on: a value set on a selection gives the row
  // that typing it into the cell would.
  it("gives the same row as typing the value into its cell", () => {
    const row = student("23108A0001")
    const { flags: _drop, ...fields } = row
    const [bulk] = editRows([row], () => true, { year: "TE" })
    expect(bulk).toEqual(flagRow({ ...fields, year: "TE" }))
  })

  it("changes nothing when it picks nothing", () => {
    const rows = [student("23108A0001"), student("23108A0002")]
    const next = editRows(rows, () => false, { year: "TE" })
    expect(next).toEqual(rows)
    expect(next[0]).toBe(rows[0])
  })

  it("returns the rows it did not pick as they were", () => {
    const rows = [student("23108A0001"), student("23108A0002")]
    const next = editRows(rows, (r) => r.rollNumber === "23108A0001", {
      year: "SE",
    })
    expect(next[1]).toBe(rows[1])
  })

  // Set in bulk or typed, a department the roll disagrees with is a typo.
  it("still flags a department the roll number disagrees with", () => {
    const rows = [student("23108A0001", { year: "TE" })]
    const [row] = editRows(rows, () => true, { department: "EXTC" })
    expect(row.flags).toEqual([
      { field: "department", message: "Roll says EXCS" },
    ])
  })

  // The roll map covers only the CS-family branches, so for any other branch
  // the department can only come from whoever is importing.
  it("fills a department the roll number cannot state", () => {
    const row = student("23201A0001", { year: "TE" })
    expect(row.flags.map((f) => f.field)).toEqual(["department"])
    const [next] = editRows([row], () => true, { department: "MECH" })
    expect(next.department).toBe("MECH")
    expect(next.flags).toEqual([])
  })

  it("keeps what the caller holds beside the fields, such as an id", () => {
    const rows = [{ ...student("23108A0001"), id: 7 }]
    const [next] = editRows(rows, () => true, { year: "BE" })
    expect(next.id).toBe(7)
    expect(next.firstName).toBe("Asha")
    expect(next.flags).toEqual([])
  })
})

describe("rollNeedsDepartment", () => {
  it("is false for a roll whose branch names its department", () => {
    expect(rollNeedsDepartment("23108A0054")).toBe(false)
  })

  // The only rows a department set on a selection lands on.
  it("is true for a branch the roll map does not know", () => {
    expect(rollNeedsDepartment("23201A0001")).toBe(true)
  })

  // Fixed first, after which the department follows from the roll. A known
  // branch with a division it does not run still names its department.
  it("is false for a roll that will not parse", () => {
    expect(rollNeedsDepartment("CLASS")).toBe(false)
    expect(rollNeedsDepartment("23108C0001")).toBe(false)
  })
})
