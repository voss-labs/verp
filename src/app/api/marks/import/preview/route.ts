import { NextRequest } from "next/server"
import ExcelJS from "exceljs"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { getClassById } from "@/db/queries/classes"
import { getStudentsByClassIds } from "@/db/queries/students"
import { extractRows, guessTargets } from "@/lib/marks-import"
import { pdfToLines } from "@/lib/pdf-extract"

export const dynamic = "force-dynamic"

// Server-side parse, mirroring the roster importer: the file is read once and
// only the structured, roster-matched preview goes back to the browser. The raw
// PDF/xlsx is never round-tripped.
const MAX_ROWS = 3000

function xlsxToLines(sheet: ExcelJS.Worksheet): string[][] {
  const out: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = (cell.text ?? "").toString().trim()
    })
    out.push(cells)
  })
  return out
}

// Best-effort column headers: the line that names the mark columns (ISA / MSE /
// ESE / Total / Average) with the Sr/Roll/Name labels stripped, aligned to the
// trailing mark columns. Only seeds the mapping — the faculty confirms it.
function guessHeaders(lines: string[][], columnCount: number): string[] {
  const header = lines.find(
    (l) =>
      /ISA|MSE|ESE|Total|Average/i.test(l.join(" ")) &&
      !l.some((c) => /^\d{2}\d{3}[A-Z]\d{4}$/i.test(c.trim()))
  )
  if (!header) return Array(columnCount).fill("")
  const cols = header
    .map((c) => c.trim())
    .filter((c) => c && !/^(sr|s)\.?\s*no|roll|name|student/i.test(c))
  return Array.from({ length: columnCount }, (_, i) => cols[cols.length - columnCount + i] ?? "")
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!can(user, "marks:write")) return apiError("Forbidden", 403)

    const form = await req.formData()
    const file = form.get("file")
    const classId = (form.get("classId") ?? "").toString()
    if (!(file instanceof File)) return apiError("No file uploaded", 400)
    if (!classId) return apiError("No class specified", 400)

    // The class must be in the caller's scope, same rule as the marks actions.
    const cls = await getClassById(classId)
    if (!cls) return apiError("No such class", 404)
    const inScope =
      user!.tier === "super_admin" ||
      user!.classIds.includes(classId) ||
      (user!.tier === "hod" && user!.deptCodes.includes(cls.departmentCode))
    if (!inScope) return apiError("That class is not in your scope", 403)

    const buffer = Buffer.from(await file.arrayBuffer())
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")

    let lines: string[][]
    if (isPdf) {
      lines = await pdfToLines(buffer)
    } else {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0])
      if (wb.worksheets.length === 0)
        return apiError("The file has no sheets", 400)
      lines = wb.worksheets.flatMap((w) => xlsxToLines(w))
    }

    const { rows, columnCount } = extractRows(lines)
    if (rows.length === 0)
      return apiError(
        "No student rows found. Check the file has roll numbers and marks.",
        400
      )
    const trimmed = rows.slice(0, MAX_ROWS)

    // Match each parsed roll against this class's roster. Rows from another
    // division (files often stack A and B) or not-yet-enrolled students match
    // nothing and are flagged, never written.
    const roster = await getStudentsByClassIds([classId])
    const byRoll = new Map(roster.map((s) => [s.rollNumber.toUpperCase(), s]))

    const previewRows = trimmed.map((r) => {
      const student = byRoll.get(r.rollNumber)
      return {
        rollNumber: r.rollNumber,
        name: r.name,
        marks: r.marks,
        studentId: student?.id ?? null,
        matched: Boolean(student),
      }
    })

    const headers = guessHeaders(lines, columnCount)
    return apiSuccess({
      columnCount,
      headers,
      guess: guessTargets(headers),
      rows: previewRows,
      totalRows: previewRows.length,
      matchedRows: previewRows.filter((r) => r.matched).length,
      truncated: rows.length > MAX_ROWS,
    })
  } catch (err) {
    console.error("Failed to preview marks import:", err)
    return apiError(getErrorMessage(err, "Could not read that file"), 500)
  }
}
