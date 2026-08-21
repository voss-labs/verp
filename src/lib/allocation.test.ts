import { describe, expect, it } from "vitest"
import {
  canAllocate,
  canReopenLock,
  canWriteOffering,
  classTeacherOptions,
  countClassTeachers,
  inDeptScope,
  type AllocationActor,
} from "./allocation"

const CLASS = "class-1"
const DEPT = "EXCS"
const base: AllocationActor = {
  tier: "faculty",
  facultyId: "f-tr",
  deptCodes: [],
  coordinatorClassIds: [],
}
const tr = base
const coordinator: AllocationActor = {
  ...base,
  facultyId: "f-ac",
  coordinatorClassIds: [CLASS],
}
const hod: AllocationActor = {
  tier: "hod",
  facultyId: "f-hod",
  deptCodes: [DEPT],
  coordinatorClassIds: [],
}
const admin: AllocationActor = {
  tier: "super_admin",
  facultyId: null,
  deptCodes: [],
  coordinatorClassIds: [],
}

describe("canAllocate", () => {
  it("admits the coordinator, the HOD and super_admin", () => {
    for (const u of [coordinator, hod, admin]) {
      expect(canAllocate(u, CLASS, DEPT)).toBe(true)
    }
  })

  it("excludes a plain TR", () => {
    expect(canAllocate(tr, CLASS, DEPT)).toBe(false)
  })

  it("keeps an HOD inside their own department", () => {
    expect(canAllocate(hod, CLASS, "CMPN")).toBe(false)
  })

  it("keeps a coordinator to the class they coordinate", () => {
    expect(canAllocate(coordinator, "other-class", DEPT)).toBe(false)
  })
})

describe("canWriteOffering", () => {
  it("lets the allocated teacher write their own subject", () => {
    expect(canWriteOffering(tr, "f-tr", CLASS, DEPT)).toBe(true)
  })

  // The regression this file exists for: batch actions skipped this check, so a
  // TR could rearrange the lab groups of a colleague's subject.
  it("refuses a teacher a subject allocated to somebody else", () => {
    expect(canWriteOffering(tr, "f-other", CLASS, DEPT)).toBe(false)
  })

  it("refuses a teacher an unallocated subject", () => {
    expect(canWriteOffering(tr, null, CLASS, DEPT)).toBe(false)
  })

  it("lets the coordinator and HOD cover any subject on the class", () => {
    for (const u of [coordinator, hod, admin]) {
      expect(canWriteOffering(u, "f-other", CLASS, DEPT)).toBe(true)
      expect(canWriteOffering(u, null, CLASS, DEPT)).toBe(true)
    }
  })

  // facultyId is null for a super_admin with no faculty row; that must not
  // accidentally match an unallocated subject's null.
  it("does not match a null actor to a null allocation", () => {
    const ghost: AllocationActor = { ...base, facultyId: null }
    expect(canWriteOffering(ghost, null, CLASS, DEPT)).toBe(false)
  })
})

// The rule stated plainly: one subject taught to two divisions is two offerings,
// and each belongs to its own teacher. CS has divisions A and B; if Teacher X
// takes Computer Science for A, she fills marks for A and nothing else — not B,
// even though it is the same course in the same department.
describe("division isolation", () => {
  const DIV_A = "class-cs-a"
  const DIV_B = "class-cs-b"
  const teacherX: AllocationActor = {
    tier: "faculty",
    facultyId: "f-x",
    deptCodes: [],
    coordinatorClassIds: [],
  }
  const teacherY: AllocationActor = { ...teacherX, facultyId: "f-y" }

  // Same course, two divisions, two offerings, two teachers.
  const offeringA = { classId: DIV_A, facultyId: "f-x" }
  const offeringB = { classId: DIV_B, facultyId: "f-y" }

  it("lets each teacher write only their own division", () => {
    expect(
      canWriteOffering(teacherX, offeringA.facultyId, offeringA.classId, "CMPN")
    ).toBe(true)
    expect(
      canWriteOffering(teacherY, offeringB.facultyId, offeringB.classId, "CMPN")
    ).toBe(true)
  })

  it("refuses each teacher the other division of the same subject", () => {
    expect(
      canWriteOffering(teacherX, offeringB.facultyId, offeringB.classId, "CMPN")
    ).toBe(false)
    expect(
      canWriteOffering(teacherY, offeringA.facultyId, offeringA.classId, "CMPN")
    ).toBe(false)
  })

  it("does not leak across departments either", () => {
    const cmpnHod: AllocationActor = {
      tier: "hod",
      facultyId: "f-hod",
      deptCodes: ["CMPN"],
      coordinatorClassIds: [],
    }
    expect(canWriteOffering(cmpnHod, "f-x", offeringA.classId, "CMPN")).toBe(
      true
    )
    expect(canWriteOffering(cmpnHod, "f-x", offeringA.classId, "EXCS")).toBe(
      false
    )
  })

  it("scopes a coordinator to the division they coordinate", () => {
    const coordA: AllocationActor = {
      tier: "faculty",
      facultyId: "f-ac",
      deptCodes: [],
      coordinatorClassIds: [DIV_A],
    }
    expect(canWriteOffering(coordA, "f-x", DIV_A, "CMPN")).toBe(true)
    expect(canWriteOffering(coordA, "f-y", DIV_B, "CMPN")).toBe(false)
  })
})

describe("canReopenLock", () => {
  const CLASS2 = "class-1"
  const DEPT2 = "EXCS"
  const teacherA: AllocationActor = {
    tier: "faculty",
    facultyId: "f-a",
    deptCodes: [],
    coordinatorClassIds: [],
  }
  const teacherB: AllocationActor = { ...teacherA, facultyId: "f-b" }

  // The whole point of the change: locking your own marks must not require
  // somebody else to undo it.
  it("lets the teacher who locked it reopen it", () => {
    expect(canReopenLock(teacherA, CLASS2, DEPT2, "f-a")).toBe(true)
  })

  it("still refuses a different teacher", () => {
    expect(canReopenLock(teacherB, CLASS2, DEPT2, "f-a")).toBe(false)
  })

  it("lets the coordinator and the HOD reopen anybody's lock", () => {
    const coord: AllocationActor = {
      ...teacherB,
      coordinatorClassIds: [CLASS2],
    }
    const hod2: AllocationActor = {
      tier: "hod",
      facultyId: "f-hod",
      deptCodes: [DEPT2],
      coordinatorClassIds: [],
    }
    expect(canReopenLock(coord, CLASS2, DEPT2, "f-a")).toBe(true)
    expect(canReopenLock(hod2, CLASS2, DEPT2, "f-a")).toBe(true)
  })

  // Locks recorded before the owner was tracked carry null, and a teacher whose
  // own facultyId is null must not match them.
  it("does not let a null actor claim an unowned lock", () => {
    expect(
      canReopenLock({ ...teacherA, facultyId: null }, CLASS2, DEPT2, null)
    ).toBe(false)
    expect(canReopenLock(teacherA, CLASS2, DEPT2, null)).toBe(false)
  })
})

describe("inDeptScope", () => {
  const hod = (...depts: string[]) => ({
    tier: "hod" as const,
    deptCodes: depts,
  })

  it("lets an HOD act in their own department", () => {
    expect(inDeptScope(hod("EXCS"), "EXCS")).toBe(true)
  })

  // The gap this closes: an HOD of one department creating or deactivating
  // faculty in another, through the administration console.
  it("stops an HOD acting in somebody else's department", () => {
    expect(inDeptScope(hod("EXCS"), "EXTC")).toBe(false)
  })

  it("covers an HOD appointed over more than one department", () => {
    expect(inDeptScope(hod("EXCS", "EXTC"), "EXTC")).toBe(true)
  })

  it("lets a super-admin act anywhere, holding no department at all", () => {
    expect(inDeptScope({ tier: "super_admin", deptCodes: [] }, "EXTC")).toBe(
      true
    )
  })

  it("refuses a teacher, who has no department scope", () => {
    expect(inDeptScope({ tier: "faculty", deptCodes: [] }, "EXCS")).toBe(false)
  })

  it("refuses an unplaced account", () => {
    expect(inDeptScope({ tier: null, deptCodes: [] }, "EXCS")).toBe(false)
  })
})

describe("classTeacherOptions", () => {
  const staff = [
    { facultyId: "f-ac", name: "Asha Rao", role: "academic_coordinator" },
    { facultyId: "f-tr", name: "Bhavesh Kale", role: "tr" },
  ]

  it("keeps a holder with no assignment row on the list", () => {
    const options = classTeacherOptions(staff, [
      { facultyId: "f-hod", name: "Chitra Nene" },
    ])
    expect(options.map((o) => o.facultyId)).toEqual(["f-ac", "f-tr", "f-hod"])
    expect(options.find((o) => o.facultyId === "f-hod")?.role).toBeNull()
  })

  it("resolves every allocated id to an option", () => {
    const allocated = ["f-tr", "f-hod", "f-gone"]
    const options = classTeacherOptions(
      staff,
      allocated.map((facultyId) => ({ facultyId, name: facultyId }))
    )
    for (const id of allocated) {
      expect(options.some((o) => o.facultyId === id)).toBe(true)
    }
  })

  it("does not list a teacher twice when they are both staff and allocated", () => {
    const options = classTeacherOptions(staff, [
      { facultyId: "f-tr", name: "Bhavesh Kale" },
    ])
    expect(options).toHaveLength(2)
    expect(options.find((o) => o.facultyId === "f-tr")?.role).toBe("tr")
  })

  it("orders by name so the list does not shuffle between loads", () => {
    const options = classTeacherOptions(
      [{ facultyId: "f-z", name: "Zoya Sheikh", role: "tr" }],
      [{ facultyId: "f-a", name: "Anil Desai" }]
    )
    expect(options.map((o) => o.name)).toEqual(["Anil Desai", "Zoya Sheikh"])
  })

  it("returns nothing for a class with no staff and no allocations", () => {
    expect(classTeacherOptions([], [])).toEqual([])
  })
})

describe("countClassTeachers", () => {
  const staff = [
    { facultyId: "f-ac", role: "academic_coordinator" },
    { facultyId: "f-tr", role: "tr" },
  ]

  it("counts a holder the class has no tr row for", () => {
    expect(countClassTeachers([], ["f-hod", null])).toBe(1)
  })

  it("cannot read None while a subject is allocated", () => {
    const allocated = [null, "f-hod", null, null]
    const unallocated = allocated.filter((id) => !id).length
    expect(unallocated).toBeLessThan(allocated.length)
    expect(countClassTeachers([], allocated)).toBeGreaterThan(0)
  })

  it("counts a tr who holds no subject yet", () => {
    expect(countClassTeachers(staff, [null])).toBe(1)
  })

  it("counts a coordinator only once they teach something", () => {
    expect(countClassTeachers(staff, ["f-ac"])).toBe(2)
  })

  it("does not double-count a tr who holds two subjects", () => {
    expect(countClassTeachers(staff, ["f-tr", "f-tr"])).toBe(1)
  })

  it("is None only when nobody teaches and nobody is appointed", () => {
    expect(countClassTeachers([], [null, undefined])).toBe(0)
  })
})
