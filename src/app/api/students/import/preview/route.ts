import { NextRequest } from "next/server"
import ExcelJS from "exceljs"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import {
  buildPreviewRows,
  detectHeaderRow,
  dataStartIndex,
  yearFromSheetName,
} from "@/lib/xlsx-import"

export const dynamic = "force-dynamic"

// Server-side parse, deliberately. The mapping, header detection and roll-number
// validation live in one trusted place, and the raw file is never round-tripped
// back to the browser — the TR uploads once, edits the parsed preview, commits.
const MAX_ROWS = 2000

function readSheet(sheet: ExcelJS.Worksheet): string[][] {
  const out: string[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = (cell.text ?? "").toString().trim()
    })
    out.push(cells)
  })
  return out
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    // Faculty (TRs) run this, not just admins — uploading a division's roster is
    // the TR's job. isStaff is the allowlist; a roleless/student user is refused.
    // Same capability the commit route requires. A preview reads the whole
    // submitted sheet back to the caller, so gating it more loosely than the
    // write would leak a roster to anyone with a staff account.
    if (!user || !can(user, "student:update")) return apiError("Forbidden", 403)

    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return apiError("No file uploaded", 400)
    const requestedSheet = (form.get("sheet") ?? "").toString()

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0])

    const sheetNames = wb.worksheets.map((w) => w.name)
    if (sheetNames.length === 0) return apiError("The file has no sheets", 400)

    // Pick the requested sheet, else the first sheet with a roster header (skips
    // instruction/summary tabs), else the first sheet.
    let sheet = requestedSheet
      ? wb.worksheets.find((w) => w.name === requestedSheet)
      : undefined
    let grid: string[][] = sheet ? readSheet(sheet) : []
    let headerIdx = sheet ? detectHeaderRow(grid) : -1

    if (!sheet) {
      for (const w of wb.worksheets) {
        const g = readSheet(w)
        const h = detectHeaderRow(g)
        if (h >= 0) {
          sheet = w
          grid = g
          headerIdx = h
          break
        }
      }
      if (!sheet) {
        sheet = wb.worksheets[0]
        grid = readSheet(sheet)
        headerIdx = detectHeaderRow(grid)
      }
    }

    if (headerIdx < 0) {
      // No recognizable header — likely an instruction/summary tab. Let the TR
      // switch sheets rather than erroring.
      return apiSuccess({
        sheetNames,
        activeSheet: sheet.name,
        headerFound: false,
        rows: [],
        totalRows: 0,
        flaggedRows: 0,
        truncated: false,
      })
    }

    const headers = grid[headerIdx]
    const start = dataStartIndex(grid, headerIdx)
    const dataRows = grid
      .slice(start)
      .filter((cells) => cells.some((c) => c && c.trim()))
      .slice(0, MAX_ROWS)

    const { rows } = buildPreviewRows(
      headers,
      dataRows,
      yearFromSheetName(sheet.name)
    )

    return apiSuccess({
      sheetNames,
      activeSheet: sheet.name,
      headerFound: true,
      headerRow: headerIdx + 1,
      rows,
      totalRows: rows.length,
      flaggedRows: rows.filter((r) => r.flags.length > 0).length,
      truncated: grid.length - start > MAX_ROWS,
    })
  } catch (err) {
    console.error("Failed to preview import:", err)
    return apiError(getErrorMessage(err, "Could not read that file"), 500)
  }
}
