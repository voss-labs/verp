import { describe, expect, it } from "vitest"
import {
  computeCgpa,
  computeMarks,
  computeSgpi,
  getGradePoint,
  groupBySemester,
  type CourseInfo,
} from "./sgpi"

const theory: CourseInfo = {
  courseType: "theory",
  credits: 4,
  maxIsa: 20,
  maxMse: 20,
  maxEse: 60,
  maxTotal: 100,
}
const lab: CourseInfo = {
  courseType: "practical",
  credits: 2,
  maxIsa: 40,
  maxMse: 0,
  maxEse: 60,
  maxTotal: 100,
}

describe("getGradePoint", () => {
  it("maps each VIT band to its point", () => {
    expect(getGradePoint(80)).toBe(10)
    expect(getGradePoint(75)).toBe(9)
    expect(getGradePoint(70)).toBe(8)
    expect(getGradePoint(60)).toBe(7)
    expect(getGradePoint(50)).toBe(6)
    expect(getGradePoint(45)).toBe(5)
    expect(getGradePoint(40)).toBe(4)
  })

  it("fails below 40 and treats each boundary as inclusive", () => {
    expect(getGradePoint(39.9)).toBe("Fail")
    expect(getGradePoint(0)).toBe("Fail")
    // 40 passes, 39 does not: the boundary belongs to the higher band.
    expect(getGradePoint(40)).toBe(4)
    expect(getGradePoint(39)).toBe("Fail")
  })
})

describe("computeMarks", () => {
  it("averages the two MSEs for a theory course", () => {
    const c = computeMarks({ isa: 18, mse1: 16, mse2: 14, ese: 48 }, theory)
    expect(c.finalMse).toBe(15) // (16 + 14) / 2
    expect(c.total).toBe(81)
    expect(c.gradePoint).toBe(10)
    expect(c.status).toBe("pass")
  })

  it("treats a course with no MSE component as complete without one", () => {
    const c = computeMarks({ isa: 28, mse1: null, mse2: null, ese: 42 }, lab)
    expect(c.finalMse).toBe(0)
    expect(c.total).toBe(70)
    expect(c.gradePoint).toBe(8)
  })

  it("withholds a grade until every component is in", () => {
    const c = computeMarks({ isa: 18, mse1: 16, mse2: 14, ese: null }, theory)
    expect(c.gradePoint).toBeNull()
    expect(c.status).toBeNull()
    expect(c.creditPoints).toBeNull()
  })

  it("needs both MSEs, not just one", () => {
    const c = computeMarks({ isa: 18, mse1: 16, mse2: null, ese: 48 }, theory)
    expect(c.finalMse).toBeNull()
    expect(c.gradePoint).toBeNull()
  })

  it("marks a genuine fail rather than leaving it ungraded", () => {
    const c = computeMarks({ isa: 2, mse1: 2, mse2: 2, ese: 5 }, theory)
    expect(c.status).toBe("fail")
    expect(c.gradePoint).toBe("Fail")
    expect(c.creditPoints).toBeNull()
  })
})

describe("computeSgpi", () => {
  it("weights each grade point by its credits", () => {
    // theory 81% -> GP10 x 4cr = 40; lab 70% -> GP8 x 2cr = 16; 56/6
    const r = computeSgpi([
      { marks: { isa: 18, mse1: 16, mse2: 14, ese: 48 }, course: theory },
      { marks: { isa: 28, mse1: null, mse2: null, ese: 42 }, course: lab },
    ])
    expect(r.totalCredits).toBe(6)
    expect(r.totalCreditPoints).toBe(56)
    expect(r.sgpi).toBeCloseTo(9.33, 2)
  })

  // Regression: credits used to be added for every subject including ungraded
  // ones, so a term whose ESE had not happened reported 0 rather than "not yet".
  it("ignores a subject that has no grade yet", () => {
    const r = computeSgpi([
      { marks: { isa: 18, mse1: null, mse2: null, ese: null }, course: theory },
    ])
    expect(r.sgpi).toBeNull()
    expect(r.totalCredits).toBe(0)
  })

  it("scores only the graded subject when a term is half entered", () => {
    const r = computeSgpi([
      { marks: { isa: 18, mse1: 16, mse2: 14, ese: 48 }, course: theory },
      { marks: { isa: 10, mse1: null, mse2: null, ese: null }, course: theory },
    ])
    expect(r.sgpi).toBe(10)
    expect(r.totalCredits).toBe(4)
  })

  // A fail is a result, not an absence: its credits belong in the denominator.
  it("counts a failed subject's credits but none of its points", () => {
    const r = computeSgpi([
      { marks: { isa: 2, mse1: 2, mse2: 2, ese: 5 }, course: theory },
    ])
    expect(r.hasFail).toBe(true)
    expect(r.totalCredits).toBe(4)
    expect(r.totalCreditPoints).toBe(0)
  })

  it("returns null for an empty term", () => {
    expect(computeSgpi([]).sgpi).toBeNull()
  })
})

describe("computeCgpa", () => {
  const rows = [
    {
      semester: 5,
      marks: { isa: 18, mse1: 16, mse2: 16, ese: 48 },
      course: theory,
    },
    {
      semester: 5,
      marks: { isa: 28, mse1: null, mse2: null, ese: 42 },
      course: lab,
    },
    {
      semester: 6,
      marks: { isa: 11, mse1: 11, mse2: 11, ese: 33 },
      course: theory,
    },
  ]

  it("pools credit points across semesters", () => {
    const r = computeCgpa(groupBySemester(rows))
    expect(r.totalCredits).toBe(10)
    expect(r.cgpa).toBeCloseTo(r.totalCreditPoints / 10, 2)
    expect(r.completedSemesters).toBe(2)
  })

  it("reports semesters in order regardless of input order", () => {
    const shuffled = [rows[2], rows[0], rows[1]]
    const r = computeCgpa(groupBySemester(shuffled))
    expect(r.perSemester.map((p) => p.semester)).toEqual([5, 6])
  })

  it("raises hasFail if any semester contains one", () => {
    const r = computeCgpa(
      groupBySemester([
        ...rows,
        {
          semester: 6,
          marks: { isa: 1, mse1: 1, mse2: 1, ese: 1 },
          course: theory,
        },
      ])
    )
    expect(r.hasFail).toBe(true)
  })

  it("does not count an in-progress semester as completed", () => {
    const r = computeCgpa(
      groupBySemester([
        {
          semester: 7,
          marks: { isa: 18, mse1: null, mse2: null, ese: null },
          course: theory,
        },
      ])
    )
    expect(r.completedSemesters).toBe(0)
    expect(r.cgpa).toBeNull()
  })

  it("returns null for a student with no marks", () => {
    expect(computeCgpa([]).cgpa).toBeNull()
  })
})
