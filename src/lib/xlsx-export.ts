"use server"

import ExcelJS from "exceljs"
import {
  computeMarks,
  computeSgpi,
  type MarksInput,
  type CourseInfo,
} from "@/lib/sgpi"

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF002060" },
}
const SUBHEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF73B2FF" },
}
const SUMMARY_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF46BDC6" },
}
const PASS_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD5F5E3" },
}
const FAIL_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFADBD8" },
}

const BASE_FONT: Partial<ExcelJS.Font> = { name: "Calibri", size: 11 }
const BOLD_FONT: Partial<ExcelJS.Font> = { ...BASE_FONT, bold: true }
const WHITE_BOLD: Partial<ExcelJS.Font> = {
  ...BASE_FONT,
  bold: true,
  color: { argb: "FFFFFFFF" },
}
const CENTER: Partial<ExcelJS.Alignment> = {
  horizontal: "center",
  vertical: "middle",
}
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
}

type MarksRow = {
  rollNumber: string
  name: string
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
}

/**
 * Export marks for a single course offering as XLSX.
 * Returns base64-encoded buffer.
 */
export async function exportMarksXlsx(params: {
  courseCode: string
  courseName: string
  courseType: string
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  division: string | null
  facultyName: string
  rows: MarksRow[]
}): Promise<string> {
  const {
    courseCode,
    courseName,
    courseType,
    maxIsa,
    maxMse,
    maxEse,
    maxTotal,
    division,
    facultyName,
    rows,
  } = params
  const hasMse = maxMse > 0
  const courseInfo: CourseInfo = {
    courseType,
    credits: 0,
    maxIsa,
    maxMse,
    maxEse,
    maxTotal,
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(courseCode, {
    views: [{ state: "frozen", ySplit: 3 }],
  })

  // Title row
  const titleRow = ws.getRow(1)
  titleRow.height = 24
  const lastCol = hasMse ? 12 : 9
  ws.mergeCells(1, 1, 1, lastCol)
  const titleCell = titleRow.getCell(1)
  titleCell.value = `${courseCode} - ${courseName}${division ? ` (Div ${division})` : ""}`
  titleCell.font = WHITE_BOLD
  titleCell.fill = HEADER_FILL
  titleCell.alignment = CENTER

  // Info row
  const infoRow = ws.getRow(2)
  ws.mergeCells(2, 1, 2, lastCol)
  const infoCell = infoRow.getCell(1)
  infoCell.value = `Faculty: ${facultyName} | Type: ${courseType} | Max: ISA(${maxIsa})${hasMse ? ` MSE(${maxMse})` : ""} ESE(${maxEse}) Total(${maxTotal})`
  infoCell.font = BOLD_FONT
  infoCell.fill = SUBHEADER_FILL
  infoCell.alignment = CENTER

  // Header row
  const headers = ["#", "Roll No.", "Name", `ISA (${maxIsa})`]
  if (hasMse)
    headers.push(`MSE-1 (${maxMse})`, `MSE-2 (${maxMse})`, "Final MSE")
  headers.push(`ESE (${maxEse})`, "Total", "%", "GP", "Status")

  const headerRow = ws.getRow(3)
  headerRow.height = 18
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = WHITE_BOLD
    cell.fill = HEADER_FILL
    cell.alignment = CENTER
    cell.border = THIN_BORDER
  })

  // Column widths
  ws.getColumn(1).width = 5
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 25
  for (let c = 4; c <= lastCol; c++) ws.getColumn(c).width = 12

  // Data rows
  rows.forEach((row, idx) => {
    const computed = computeMarks(row, courseInfo)
    const r = ws.getRow(idx + 4)

    const vals: (string | number | null)[] = [
      idx + 1,
      row.rollNumber,
      row.name,
      row.isa,
    ]
    if (hasMse) vals.push(row.mse1, row.mse2, computed.finalMse)
    vals.push(
      row.ese,
      computed.percentage != null ? computed.total : null,
      computed.percentage,
      computed.gradePoint === "Fail" ? "Fail" : computed.gradePoint,
      computed.status === "pass"
        ? "Pass"
        : computed.status === "fail"
          ? "Fail"
          : null
    )

    vals.forEach((v, i) => {
      const cell = r.getCell(i + 1)
      cell.value = v ?? ""
      cell.font = BASE_FONT
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })

    // Color status cell
    const statusCell = r.getCell(vals.length)
    if (computed.status === "pass") statusCell.fill = PASS_FILL
    else if (computed.status === "fail") statusCell.fill = FAIL_FILL
  })

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer).toString("base64")
}

type SgpiStudentRow = {
  rollNumber: string
  name: string
  division: string | null
  courses: {
    courseCode: string
    courseName: string
    courseType: string
    credits: number
    maxIsa: number
    maxMse: number
    maxEse: number
    maxTotal: number
    isa: number | null
    mse1: number | null
    mse2: number | null
    ese: number | null
  }[]
}

/**
 * Export SGPI report for all students in a semester as XLSX.
 * Returns base64-encoded buffer.
 */
export async function exportSgpiXlsx(params: {
  semesterLabel: string
  students: SgpiStudentRow[]
}): Promise<string> {
  const { semesterLabel, students } = params

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("SGPI Report", {
    views: [{ state: "frozen", ySplit: 3 }],
  })

  const lastCol = 7

  // Title
  const titleRow = ws.getRow(1)
  titleRow.height = 24
  ws.mergeCells(1, 1, 1, lastCol)
  const titleCell = titleRow.getCell(1)
  titleCell.value = `SGPI Report - ${semesterLabel}`
  titleCell.font = WHITE_BOLD
  titleCell.fill = HEADER_FILL
  titleCell.alignment = CENTER

  // Subtitle
  const subRow = ws.getRow(2)
  ws.mergeCells(2, 1, 2, lastCol)
  const subCell = subRow.getCell(1)
  subCell.value = `${students.length} students | Generated ${new Date().toLocaleDateString()}`
  subCell.font = BOLD_FONT
  subCell.fill = SUBHEADER_FILL
  subCell.alignment = CENTER

  // Headers
  const headers = ["#", "Roll No.", "Name", "Div", "Credits", "SGPI", "Status"]
  const headerRow = ws.getRow(3)
  headerRow.height = 18
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = WHITE_BOLD
    cell.fill = HEADER_FILL
    cell.alignment = CENTER
    cell.border = THIN_BORDER
  })

  ws.getColumn(1).width = 5
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 25
  ws.getColumn(4).width = 6
  ws.getColumn(5).width = 10
  ws.getColumn(6).width = 10
  ws.getColumn(7).width = 10

  // Data
  students.forEach((student, idx) => {
    const entries = student.courses.map((c) => ({
      marks: {
        isa: c.isa,
        mse1: c.mse1,
        mse2: c.mse2,
        ese: c.ese,
      } as MarksInput,
      course: {
        courseType: c.courseType,
        credits: c.credits,
        maxIsa: c.maxIsa,
        maxMse: c.maxMse,
        maxEse: c.maxEse,
        maxTotal: c.maxTotal,
      } as CourseInfo,
    }))
    const sgpi = computeSgpi(entries)

    const r = ws.getRow(idx + 4)
    const vals: (string | number | null)[] = [
      idx + 1,
      student.rollNumber,
      student.name,
      student.division,
      sgpi.totalCredits,
      sgpi.sgpi,
      sgpi.hasFail ? "Fail" : sgpi.sgpi != null ? "Pass" : null,
    ]

    vals.forEach((v, i) => {
      const cell = r.getCell(i + 1)
      cell.value = v ?? ""
      cell.font = BASE_FONT
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })

    const statusCell = r.getCell(7)
    if (sgpi.hasFail) statusCell.fill = FAIL_FILL
    else if (sgpi.sgpi != null) statusCell.fill = PASS_FILL
  })

  // Summary row
  const summaryRowNum = students.length + 4
  const sr = ws.getRow(summaryRowNum)
  ws.mergeCells(summaryRowNum, 1, summaryRowNum, 3)
  sr.getCell(1).value = "Summary"
  sr.getCell(1).font = WHITE_BOLD
  sr.getCell(1).fill = SUMMARY_FILL
  sr.getCell(1).alignment = CENTER

  const passCount = students.filter((s) => {
    const entries = s.courses.map((c) => ({
      marks: {
        isa: c.isa,
        mse1: c.mse1,
        mse2: c.mse2,
        ese: c.ese,
      } as MarksInput,
      course: {
        courseType: c.courseType,
        credits: c.credits,
        maxIsa: c.maxIsa,
        maxMse: c.maxMse,
        maxEse: c.maxEse,
        maxTotal: c.maxTotal,
      } as CourseInfo,
    }))
    const sgpi = computeSgpi(entries)
    return sgpi.sgpi != null && !sgpi.hasFail
  }).length

  const failCount = students.filter((s) => {
    const entries = s.courses.map((c) => ({
      marks: {
        isa: c.isa,
        mse1: c.mse1,
        mse2: c.mse2,
        ese: c.ese,
      } as MarksInput,
      course: {
        courseType: c.courseType,
        credits: c.credits,
        maxIsa: c.maxIsa,
        maxMse: c.maxMse,
        maxEse: c.maxEse,
        maxTotal: c.maxTotal,
      } as CourseInfo,
    }))
    return computeSgpi(entries).hasFail
  }).length

  for (let c = 4; c <= lastCol; c++) {
    sr.getCell(c).font = WHITE_BOLD
    sr.getCell(c).fill = SUMMARY_FILL
    sr.getCell(c).alignment = CENTER
    sr.getCell(c).border = THIN_BORDER
  }
  sr.getCell(5).value = `Pass: ${passCount}`
  sr.getCell(6).value = `Fail: ${failCount}`
  sr.getCell(7).value = `Total: ${students.length}`

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer).toString("base64")
}

/**
 * Export generic tabular data as XLSX.
 * Returns base64-encoded buffer.
 */
export async function exportTableXlsx(params: {
  title: string
  subtitle?: string
  headers: string[]
  rows: (string | number | null)[][]
}): Promise<string> {
  const { title, subtitle, headers, rows } = params

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Export", {
    views: [{ state: "frozen", ySplit: subtitle ? 3 : 2 }],
  })

  const lastCol = Math.max(headers.length, 1)

  // Title
  const titleRow = ws.getRow(1)
  titleRow.height = 24
  ws.mergeCells(1, 1, 1, lastCol)
  const titleCell = titleRow.getCell(1)
  titleCell.value = title
  titleCell.font = WHITE_BOLD
  titleCell.fill = HEADER_FILL
  titleCell.alignment = CENTER

  let headerRowNum = 2

  // Subtitle
  if (subtitle) {
    const subRow = ws.getRow(2)
    ws.mergeCells(2, 1, 2, lastCol)
    const subCell = subRow.getCell(1)
    subCell.value = subtitle
    subCell.font = BOLD_FONT
    subCell.fill = SUBHEADER_FILL
    subCell.alignment = CENTER
    headerRowNum = 3
  }

  // Headers
  const headerRow = ws.getRow(headerRowNum)
  headerRow.height = 18
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = WHITE_BOLD
    cell.fill = HEADER_FILL
    cell.alignment = CENTER
    cell.border = THIN_BORDER

    // Auto-width approximation
    const col = ws.getColumn(i + 1)
    col.width = Math.max(12, h.length + 4)
  })

  // Data
  rows.forEach((rowData, idx) => {
    const r = ws.getRow(headerRowNum + 1 + idx)
    rowData.forEach((val, i) => {
      const cell = r.getCell(i + 1)
      cell.value = val ?? ""
      cell.font = BASE_FONT
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })
  })

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer).toString("base64")
}

/**
 * Export generic tabular data as CSV.
 * Returns base64-encoded buffer.
 */
export async function exportTableCsv(params: {
  headers: string[]
  rows: (string | number | null)[][]
}): Promise<string> {
  const { headers, rows } = params

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Export")

  // Headers
  const headerRow = ws.getRow(1)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })

  // Data
  rows.forEach((rowData, idx) => {
    const r = ws.getRow(idx + 2)
    rowData.forEach((val, i) => {
      r.getCell(i + 1).value = val ?? ""
    })
  })

  const buffer = await wb.csv.writeBuffer()
  return Buffer.from(buffer).toString("base64")
}
