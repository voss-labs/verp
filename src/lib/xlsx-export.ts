"use server"

import ExcelJS from "exceljs"

// Generic table export used by the students / faculty / audit tables. Returns a
// base64-encoded buffer the client turns into a download.

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
