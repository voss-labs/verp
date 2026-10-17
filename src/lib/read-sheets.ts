import ExcelJS from "exceljs"

/** One tab of an uploaded sheet, as rows of cell text. */
export type SheetGrid = { name: string; grid: string[][] }

/**
 * Read an uploaded .xlsx (every tab) or .csv (its one table) into rows of cell
 * text, the shape the importers match against. Server-side only, like the
 * roster and marks previews: the file is read here and never sent back.
 */
export async function readSheets(file: File): Promise<SheetGrid[]> {
  const buffer = Buffer.from(await file.arrayBuffer())
  if (file.name.toLowerCase().endsWith(".csv")) {
    // A roll number never holds a comma, so a plain split finds every one even
    // when a quoted name beside it does.
    const grid = buffer
      .toString("utf-8")
      .split(/\r?\n/)
      .map((line) =>
        line.split(/[,;\t]/).map((c) => c.replace(/"/g, "").trim())
      )
    return [{ name: file.name.replace(/\.csv$/i, ""), grid }]
  }
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0])
  } catch {
    throw new Error(
      "Could not read that file. Save it as .xlsx or .csv and try again."
    )
  }
  return wb.worksheets.map((sheet) => {
    const grid: string[][] = []
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = (cell.text ?? "").toString().trim()
      })
      grid.push(cells)
    })
    return { name: sheet.name, grid }
  })
}
