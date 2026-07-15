import { NextRequest } from "next/server"
import ExcelJS from "exceljs"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { getSessionUser, isStaff } from "@/lib/session"
import { buildPreviewRows } from "@/lib/xlsx-import"

export const dynamic = "force-dynamic"

// Server-side parse, deliberately. The mapping and roll-number validation live
// in one trusted place, and the raw file is never round-tripped back to the
// browser — the TR uploads once, edits the parsed preview, then commits.
const MAX_ROWS = 2000

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    // Faculty (TRs) run this, not just admins — uploading a division's roster is
    // the TR's job. isStaff is the allowlist; a roleless/student user is refused.
    if (!isStaff(user)) return apiError("Forbidden", 403)

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return apiError("No file uploaded", 400)

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(
      buffer as unknown as Parameters<typeof wb.xlsx.load>[0]
    )

    const sheet = wb.worksheets[0]
    if (!sheet || sheet.rowCount < 2) {
      return apiError("The sheet is empty or has no data rows", 400)
    }

    // First non-empty row is the header.
    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = (cell.text ?? "").toString().trim()
    })

    const grid: string[][] = []
    for (let r = 2; r <= sheet.rowCount && grid.length < MAX_ROWS; r++) {
      const row = sheet.getRow(r)
      const cells: string[] = []
      let hasAny = false
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = (cell.text ?? "").toString().trim()
        cells[col - 1] = v
        if (v) hasAny = true
      })
      if (hasAny) grid.push(cells)
    }

    if (grid.length === 0) return apiError("No data rows found", 400)

    const { mapping, rows } = buildPreviewRows(headers, grid, new Date())

    const truncated = sheet.rowCount - 1 > MAX_ROWS

    return apiSuccess({
      headers,
      mapping,
      rows,
      totalRows: rows.length,
      flaggedRows: rows.filter((r) => r.flags.length > 0).length,
      truncated,
    })
  } catch (err) {
    console.error("Failed to preview import:", err)
    return apiError(getErrorMessage(err, "Could not read that file"), 500)
  }
}
