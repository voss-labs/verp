import { describe, expect, it } from "vitest"
import { extractNames, parseSyllabus } from "./syllabus-import"

// A scheme row as pdfToLines returns it: cells left-to-right, the numeric tail
// always last. The leading columns differ per regulation, which is the point.
const TY = [
  "PC-PCC",
  "PCEC08T",
  "Basic VLSI Design",
  "Theory",
  "2",
  "15",
  "20",
  "40",
  "075",
]
const TY_LAB = [
  "PCEC08P",
  "Basic VLSI Design Lab",
  "Practical",
  "1",
  "25",
  "-",
  "25",
  "050",
]
// First Year carries prerequisite, prerequisite-for, KSA and three hour columns
// before the credits, and names no type at all.
const FY = [
  "BSES_BSC",
  "BSC10T",
  "Engineering Physics",
  "NIL",
  "NIL",
  "K",
  "2",
  "-",
  "-",
  "2",
  "15",
  "20",
  "40",
  "075",
]

const detailPage = (code: string, name: string) =>
  `Course Name: ${name} Course Code: ${code} NEP Vertical Basket: PC_PCC Preamble:`

describe("extractNames", () => {
  it("reads the labelled name/code pair off a detail page", () => {
    const m = extractNames([detailPage("PCEC08T", "Basic VLSI Design")])
    expect(m.get("PCEC08T")).toBe("Basic VLSI Design")
  })

  it("reads the pair in either order", () => {
    const m = extractNames([
      "Course Code: EC34T Course Name: Big Data Analytics NEP",
    ])
    expect(m.get("EC34T")).toBe("Big Data Analytics")
  })

  it("ignores prose that merely mentions a course", () => {
    expect(
      extractNames(["This course builds on PCEC08T and others."]).size
    ).toBe(0)
  })
})

describe("parseSyllabus", () => {
  it("reads code, type, credits and the marks split off a scheme row", () => {
    const [c] = parseSyllabus(
      [TY],
      [detailPage("PCEC08T", "Basic VLSI Design")]
    )
    expect(c).toMatchObject({
      courseCode: "PCEC08T",
      courseName: "Basic VLSI Design",
      courseType: "theory",
      credits: 2,
      maxIsa: 15,
      maxMse: 20,
      maxEse: 60 - 20,
      maxTotal: 75,
      nameSource: "detail",
    })
  })

  it("reads a dash as a zero component", () => {
    const [c] = parseSyllabus(
      [TY_LAB],
      [detailPage("PCEC08P", "Basic VLSI Design Lab")]
    )
    expect(c.maxMse).toBe(0)
    expect(c.courseType).toBe("practical")
  })

  // The First Year layout defeated a left-to-right parser entirely: reading the
  // numeric tail from the right is what makes one parser cover every regulation.
  it("handles the First Year layout's extra leading columns", () => {
    const [c] = parseSyllabus(
      [FY],
      [detailPage("BSC10T", "Engineering Physics")]
    )
    expect(c).toMatchObject({
      courseCode: "BSC10T",
      credits: 2,
      maxIsa: 15,
      maxTotal: 75,
    })
  })

  // Digits are what separate a course from a basket: BSC is a vertical, BSC10T
  // is a course. Stripping them before comparing rejected every FY code.
  it("does not mistake the NEP vertical for the course code", () => {
    const [c] = parseSyllabus([TY], [])
    expect(c.courseCode).toBe("PCEC08T")
  })

  it("infers type from the code suffix when the row names none", () => {
    const lab = [
      "BSES_BSC",
      "BSC10P",
      "Physics Lab",
      "NIL",
      "NIL",
      "S",
      "-",
      "2",
      "-",
      "1",
      "25",
      "-",
      "25",
      "050",
    ]
    const [c] = parseSyllabus([lab], [])
    expect(c.courseType).toBe("practical")
  })

  // The arithmetic is the row detector: anything that does not balance is not a
  // course row, which is what keeps headers and totals out of the result.
  it("rejects a row whose components do not sum to the total", () => {
    const bad = [
      "PC-PCC",
      "PCEC99T",
      "Broken",
      "Theory",
      "2",
      "15",
      "20",
      "40",
      "100",
    ]
    expect(parseSyllabus([bad], [])).toHaveLength(0)
  })

  it("rejects headers and prose", () => {
    const rows = [
      ["Course", "Head of", "Learning", "Credits", "ISA", "MSE", "ESE"],
      ["Total", "Credits", "21"],
      ["ISA=In Semester Assessment,", "MSE=", "Mid", "Semester"],
    ]
    expect(parseSyllabus(rows, [])).toHaveLength(0)
  })

  it("flags a placeholder elective rather than importing it as a course", () => {
    const ph = [
      "PC-PEC",
      "PEECXXT",
      "Professional Elective-1",
      "Theory",
      "2",
      "15",
      "20",
      "40",
      "075",
    ]
    const [c] = parseSyllabus([ph], [])
    expect(c.warnings.join(" ")).toMatch(/[Pp]laceholder/)
  })

  it("marks a name it had to read off the table, so it is never trusted silently", () => {
    const [c] = parseSyllabus([TY], [])
    expect(c.nameSource).not.toBe("detail")
    expect(c.warnings.length).toBeGreaterThan(0)
  })

  it("prefers the detail-page name over anything recovered from the table", () => {
    const [c] = parseSyllabus(
      [TY],
      [detailPage("PCEC08T", "Basic VLSI Design")]
    )
    expect(c.nameSource).toBe("detail")
    expect(c.courseName).toBe("Basic VLSI Design")
  })

  it("deduplicates a course listed on both a semester and an elective table", () => {
    const out = parseSyllabus(
      [TY, TY],
      [detailPage("PCEC08T", "Basic VLSI Design")]
    )
    expect(out).toHaveLength(1)
  })

  it("returns rows sorted by code", () => {
    const out = parseSyllabus([TY_LAB, TY], [])
    expect(out.map((c) => c.courseCode)).toEqual(["PCEC08P", "PCEC08T"])
  })
})
