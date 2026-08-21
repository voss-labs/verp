import { describe, expect, it } from "vitest"
import { buildAttention } from "./attention"
import type { ClassWork, DeptHealth } from "@/db/queries/overview"

const cls = (over: Partial<ClassWork> = {}): ClassWork => ({
  classId: "c1",
  classKey: "2023-108-A",
  admissionYear: 2023,
  division: "A",
  departmentCode: "EXCS",
  role: "tr",
  students: 60,
  pendingRequests: 0,
  markedToday: 0,
  mySubjects: [],
  unallocatedSubjects: 0,
  ...over,
})

const dept = (over: Partial<DeptHealth> = {}): DeptHealth => ({
  code: "EXCS",
  name: "Computer Engineering",
  hod: "A B",
  classes: 4,
  classesWithoutCoordinator: 0,
  faculty: 20,
  students: 240,
  unclaimedStudents: 0,
  unallocatedSubjects: 0,
  ...over,
})

const build = (classWork: ClassWork[], deptHealth: DeptHealth[] = []) =>
  buildAttention({ classWork, deptHealth, today: "2026-08-13" })

describe("buildAttention", () => {
  it("says nothing when there is nothing to do", () => {
    expect(build([cls({ markedToday: 60 })])).toEqual([])
  })

  // The whole point of the ranking: a big number is not an urgent one.
  it("ranks a blocking item above a larger merely-open one", () => {
    const items = build([
      cls({
        markedToday: 60,
        unallocatedSubjects: 1,
        mySubjects: [{ id: "o1", code: "EC33T", name: "DAV", entered: 0 }],
      }),
    ])
    expect(items.map((i) => i.urgency)).toEqual(["blocking", "open"])
    expect(items[0].count).toBe(1)
    expect(items[1].count).toBe(60)
  })

  it("sorts by count within one urgency", () => {
    const items = build(
      [],
      [
        dept({ code: "EXCS", classesWithoutCoordinator: 1 }),
        dept({ code: "EXTC", classesWithoutCoordinator: 3 }),
      ]
    )
    expect(items.map((i) => i.count)).toEqual([3, 1])
  })

  // An empty class has no register to take and no marks to miss. Reporting it
  // would put a permanent unclearable item in front of whoever owns that class.
  it("stays quiet about a class with no students", () => {
    expect(
      build([
        cls({
          students: 0,
          mySubjects: [{ id: "o1", code: "EC33T", name: "DAV", entered: 0 }],
        }),
      ])
    ).toEqual([])
  })

  it("does not flag a register that was already taken", () => {
    const items = build([cls({ markedToday: 60 })])
    expect(items.find((i) => i.id.startsWith("attendance:"))).toBeUndefined()
  })

  it("still flags a partly-taken register until every student is marked", () => {
    const items = build([cls({ students: 60, markedToday: 20 })])
    const register = items.find((i) => i.id.startsWith("attendance:"))
    expect(register).toBeDefined()
    expect(register?.urgency).toBe("overdue")
    expect(register?.count).toBe(40)
    expect(register?.title).toBe("Register only partly taken")
    expect(register?.detail).toContain("20 of 60 students marked")
  })

  it("counts what is missing, not what is entered", () => {
    const items = build([
      cls({
        markedToday: 60,
        mySubjects: [{ id: "o1", code: "EC33T", name: "DAV", entered: 45 }],
      }),
    ])
    expect(items[0].count).toBe(15)
    expect(items[0].title).toContain("15 students unmarked")
  })

  it("drops a subject once every student has a mark", () => {
    expect(
      build([
        cls({
          markedToday: 60,
          mySubjects: [{ id: "o1", code: "EC33T", name: "DAV", entered: 60 }],
        }),
      ])
    ).toEqual([])
  })

  it("agrees in number, both noun and verb", () => {
    expect(build([], [dept({ unclaimedStudents: 4 })])[0].title).toBe(
      "4 students have never signed in"
    )
    const items = build([], [dept({ unclaimedStudents: 1 })])
    expect(items[0].title).toBe("1 student has never signed in")
  })

  // Every item promises to land somewhere that can resolve it. A link into a
  // route that does not exist is worse than no item at all.
  it("links each item to a real workspace", () => {
    const items = build(
      [
        cls({
          pendingRequests: 2,
          unallocatedSubjects: 1,
          mySubjects: [{ id: "o1", code: "EC33T", name: "DAV", entered: 0 }],
        }),
      ],
      [dept({ classesWithoutCoordinator: 1, unclaimedStudents: 4 })]
    )
    expect(items.every((i) => i.href.startsWith("/dashboard/"))).toBe(true)
    expect(items.map((i) => i.href)).toContain(
      "/dashboard/class/c1/marks?offering=o1"
    )
    expect(items.map((i) => i.href)).toContain(
      "/dashboard/students?department=EXCS"
    )
  })

  it("gives every item a distinct id so the list can key on it", () => {
    const items = build(
      [
        cls({ classId: "c1", pendingRequests: 1, unallocatedSubjects: 1 }),
        cls({ classId: "c2", pendingRequests: 1 }),
      ],
      [dept({ unallocatedSubjects: 2 })]
    )
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
  })
})
