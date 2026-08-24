import { describe, expect, it } from "vitest"
import {
  rollsInScope,
  studentsInBatch,
  studentsInClass,
  type ImportActor,
} from "./scope"

describe("studentsInClass", () => {
  const roster = new Set(["a", "b", "c"])

  it("accepts a payload naming only class members", () => {
    expect(studentsInClass(roster, ["a", "c"]).ok).toBe(true)
  })

  it("accepts an empty payload", () => {
    expect(studentsInClass(roster, []).ok).toBe(true)
  })

  // The whole point: rejecting, not dropping. A partial write would look
  // successful and leave a forged id without a trace.
  it("rejects the request when any id is outside the class", () => {
    const r = studentsInClass(roster, ["a", "zzz"])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.offending).toEqual(["zzz"])
  })

  it("reports each offending id once", () => {
    const r = studentsInClass(roster, ["zzz", "zzz", "yyy"])
    if (!r.ok) expect(r.offending.sort()).toEqual(["yyy", "zzz"])
  })
})

describe("studentsInBatch", () => {
  const b1 = new Set(["a", "b"])

  it("accepts a payload naming only batch members", () => {
    expect(studentsInBatch(b1, ["a", "b"]).ok).toBe(true)
  })

  // A classmate in B2 is in the class and still outside this register.
  it("rejects a classmate who sits in another batch", () => {
    const r = studentsInBatch(b1, ["a", "c"])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.offending).toEqual(["c"])
  })
})

describe("rollsInScope", () => {
  const admin: ImportActor = {
    tier: "super_admin",
    deptCodes: [],
    classKeys: [],
  }
  const hod: ImportActor = { tier: "hod", deptCodes: ["EXCS"], classKeys: [] }
  const tr: ImportActor = {
    tier: "faculty",
    deptCodes: [],
    classKeys: ["2023-108-A"],
  }

  it("lets super_admin import anything", () => {
    expect(rollsInScope(admin, ["23108A0001", "24101B0002"]).ok).toBe(true)
  })

  it("holds a TR to the classes they teach", () => {
    expect(rollsInScope(tr, ["23108A0001"]).ok).toBe(true)
    // same branch, different division
    expect(rollsInScope(tr, ["23108B0001"]).ok).toBe(false)
    // same division, different cohort
    expect(rollsInScope(tr, ["24108A0001"]).ok).toBe(false)
  })

  it("holds an HOD to their department across cohorts", () => {
    expect(rollsInScope(hod, ["23108A0001", "24108B0009"]).ok).toBe(true)
    expect(rollsInScope(hod, ["23101A0001"]).ok).toBe(false) // IT
  })

  // 103 is the retired EXCS code; an older cohort still belongs to that HOD.
  it("recognises the legacy branch code for the same department", () => {
    expect(rollsInScope(hod, ["21103A0001"]).ok).toBe(true)
  })

  it("rejects a roll it cannot parse rather than admitting it unscoped", () => {
    expect(rollsInScope(hod, ["nonsense"]).ok).toBe(false)
    expect(rollsInScope(admin, ["nonsense"]).ok).toBe(true) // admin is unscoped
  })

  it("refuses a student or an unbound account outright", () => {
    const student: ImportActor = {
      tier: "student",
      deptCodes: [],
      classKeys: [],
    }
    expect(rollsInScope(student, ["23108A0001"]).ok).toBe(false)
    expect(
      rollsInScope({ tier: null, deptCodes: [], classKeys: [] }, ["23108A0001"])
        .ok
    ).toBe(false)
  })

  // A DSY roll folds back a year, so scope must be judged on the folded key.
  it("scopes a diploma-entry roll to the cohort it actually joins", () => {
    expect(rollsInScope(tr, ["24108A2001"]).ok).toBe(true)
  })
})

// A repeater is admitted a year early and carries an explicit class_key
// override, which the schema names as the one case a roll cannot express.
// Judging them by the roll alone would refuse their own teacher's import.
describe("rollsInScope with a stored class key", () => {
  const tr: ImportActor = {
    tier: "faculty",
    deptCodes: [],
    classKeys: ["2023-108-A"],
  }

  it("uses the stored key over the one the roll derives", () => {
    // 22108A0034 derives 2022-108-A but actually sits in 2023-108-A.
    expect(rollsInScope(tr, ["22108A0034"]).ok).toBe(false)
    expect(
      rollsInScope(tr, ["22108A0034"], new Map([["22108A0034", "2023-108-A"]]))
        .ok
    ).toBe(true)
  })

  it("still refuses a stored key outside scope", () => {
    expect(
      rollsInScope(tr, ["22108A0034"], new Map([["22108A0034", "2024-108-A"]]))
        .ok
    ).toBe(false)
  })

  it("falls back to the roll for a student who does not exist yet", () => {
    expect(rollsInScope(tr, ["23108A0500"], new Map()).ok).toBe(true)
  })
})
