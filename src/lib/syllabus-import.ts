// Reading a VIT syllabus PDF into catalogue rows.
//
// A syllabus states the same course twice, and each statement is good at a
// different thing:
//
//   1. The "Course Structure and Assessment Guidelines" table, one page per
//      semester, carries the code, credits and the ISA/MSE/ESE split. Its
//      NAMES are unusable — the name column wraps, so a row arrives as
//      "PCEC09P | and Applications | Practical | 1 | 25 | - | 25 | 050".
//   2. Each course's detail page opens with "Course Name: X / Course Code: Y".
//      Clean names, but no marks.
//
// So we read both and join on the code. Neither source alone is enough: parsing
// names out of the flowed table was measured at 29% wrong codes across these
// four regulations, and the First Year layout — which carries prerequisite, KSA
// and hours columns the others lack — yielded nothing at all.
//
// The numbers are read from the RIGHT. Every regulation ends a row the same way
// (credits, ISA, MSE, ESE, total) however many descriptive columns precede it,
// which is what makes one parser cover R22 through R25 and, with luck, R26.

import type { Glyph } from "@/lib/pdf-extract"

export type ParsedCourse = {
  courseCode: string
  courseName: string
  courseType: "theory" | "practical" | "project"
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  /**
   * Where the name came from, because the two sources are not equally good.
   * "detail" is a labelled "Course Name:" field and is trusted. "table" is
   * recovered from the scheme table's wrapping name column, which was measured
   * at roughly 55% agreement against the detail pages on these four
   * regulations — good enough to offer as a suggestion, never good enough to
   * import unread. "none" means neither source had it.
   */
  nameSource: "detail" | "table" | "none"
  /** Non-fatal problems for the reviewer to resolve before importing. */
  warnings: string[]
}

// NEP vertical / basket labels that sit in the leading columns. They look like
// codes and must never be mistaken for one.
const VERTICALS = new Set([
  "PC",
  "PCC",
  "PEC",
  "BSC",
  "ESC",
  "SC",
  "MC",
  "OE",
  "OEC",
  "ELC",
  "MDM",
  "HSSM",
  "AEC",
  "VSEC",
  "CC",
  "LLC",
  "BSES",
  "VEC",
  "CEP",
  "EEMC",
  "PRJ",
  "ISA",
  "MSE",
  "ESE",
  "NEP",
  "KSA",
  "NIL",
])

// A real course code: letters then digits, optionally a T/P suffix for the
// theory/lab pair. PCEC08T, BSC02, MDMIE01, EC46.
const CODE = /^[A-Z]{2,6}\d{1,3}[A-Z]?$/

// Template rows standing in for "whichever elective the student picks".
const PLACEHOLDER = /X{2,}|\bxx\b/i

const num = (v: string): number | null => {
  const t = v.trim()
  if (t === "-" || t === "–" || t === "") return 0
  if (!/^\d{1,3}$/.test(t)) return null
  return Number(t)
}

function looksLikeCode(cell: string): boolean {
  const c = cell.trim().replace(/[$*#]/g, "").toUpperCase()
  // The digits are what separate a code from a vertical: BSC is a basket,
  // BSC02 is a course. Stripping the digits before comparing rejected every
  // First Year code, whose prefixes (BSC, ESC, AEC, VSEC) are all basket names.
  if (!CODE.test(c)) return false
  return !VERTICALS.has(c)
}

/** Course name -> code map from the per-course detail pages. */
export function extractNames(pages: string[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const page of pages) {
    const flat = page.replace(/\s+/g, " ")
    const a = /Course Name\s*:\s*(.+?)\s+Course Code\s*:\s*([A-Z0-9]+)/i.exec(
      flat
    )
    if (a) {
      out.set(a[2].trim().toUpperCase(), a[1].trim())
      continue
    }
    const b =
      /Course Code\s*:\s*([A-Z0-9]+)\s+Course Name\s*:\s*(.+?)(?:\s+NEP|\s+Preamble|\s+Pre-requisite|$)/i.exec(
        flat
      )
    if (b) out.set(b[1].trim().toUpperCase(), b[2].trim())
  }
  return out
}

/**
 * One scheme row, read right-to-left: the last five numeric cells are
 * credits, ISA, MSE, ESE and total. Returns null for any line that is not a
 * course row — headers, totals, prose all fail the arithmetic check.
 */
function parseSchemeRow(
  cells: string[]
): Omit<ParsedCourse, "courseName" | "warnings" | "nameSource"> | null {
  if (cells.length < 5) return null
  const tail = cells.slice(-5).map((c) => num(c))
  if (tail.some((v) => v === null)) return null
  const [credits, isa, mse, ese, total] = tail as number[]
  if (credits < 1 || credits > 30 || total < 1) return null
  // The arithmetic IS the row detector: a real course row always balances, and
  // nothing else on the page does so by accident.
  if (isa + mse + ese !== total) return null

  const codeCell = cells.slice(0, -5).find(looksLikeCode)
  if (!codeCell) return null
  const courseCode = codeCell.trim().replace(/[$*#]/g, "").toUpperCase()

  const typeCell = cells.find((c) =>
    /^(Theory|Practical|Tutorial)$/i.test(c.trim())
  )
  let courseType: ParsedCourse["courseType"]
  if (typeCell) {
    courseType = /practical/i.test(typeCell) ? "practical" : "theory"
  } else {
    // First Year rows name no type; the code's T/P suffix carries it instead.
    courseType = courseCode.endsWith("P") ? "practical" : "theory"
  }
  if (/^PRJ|PROJ/i.test(courseCode)) courseType = "project"

  return {
    courseCode,
    courseType,
    credits,
    maxIsa: isa,
    maxMse: mse,
    maxEse: ese,
    maxTotal: total,
  }
}

export function parseSyllabus(
  lines: string[][],
  pages: string[],
  glyphPages: Glyph[][] = []
): ParsedCourse[] {
  // Detail pages first — they give the name exactly as the syllabus writes it.
  // The scheme table is the fallback for courses with no detail page, which is
  // most of the Final Year electives.
  const names = extractNames(pages)
  const fromTable = namesFromSchemeTable(glyphPages)
  const byCode = new Map<string, ParsedCourse>()

  for (const cells of lines) {
    const row = parseSchemeRow(cells)
    if (!row) continue

    const warnings: string[] = []
    const detail = names.get(row.courseCode)
    const guess = fromTable.get(row.courseCode)
    const name = detail ?? guess
    const nameSource: ParsedCourse["nameSource"] = detail
      ? "detail"
      : guess
        ? "table"
        : "none"
    if (PLACEHOLDER.test(row.courseCode)) {
      warnings.push(
        "Placeholder code — stands for an elective the student picks"
      )
    }
    if (nameSource === "table") {
      warnings.push("Name read off the table — check it against the syllabus")
    } else if (nameSource === "none") {
      warnings.push("No name found; type it before importing")
    }
    // A lab whose code says theory (or the reverse) is usually a typo in the
    // syllabus itself; surface it rather than silently trusting either side.
    if (name && /\blab\b/i.test(name) && row.courseType !== "practical") {
      warnings.push("Named as a lab but typed as theory — check")
    }

    const parsed: ParsedCourse = {
      ...row,
      courseName: name ?? "",
      nameSource,
      warnings,
    }
    // The same course appears on both the semester table and an elective table;
    // keep whichever copy resolved a name.
    const prev = byCode.get(row.courseCode)
    const better =
      !prev ||
      (prev.nameSource !== "detail" && parsed.nameSource === "detail") ||
      (prev.nameSource === "none" && parsed.nameSource === "table")
    if (better) {
      byCode.set(row.courseCode, parsed)
    }
  }

  return [...byCode.values()].sort((a, b) =>
    a.courseCode.localeCompare(b.courseCode)
  )
}

// ── column-aware name recovery ─────────────────────────────────────────────
//
// The scheme table's name column wraps. "IoT and Edge Computing" is three
// items at one x and three different y values, straddling the y its code sits
// on — so a row-based read splits it across three rows and loses all of it.
//
// The fix needs no new library. pdf.js already reports what pdfplumber, camelot
// and tabula work from: every glyph's (x, y). Reading the column directly is
// what those tools do internally, and doing it here avoids taking a Python or
// JVM dependency into a Next app for a page that runs twice a year.
//
// Each fragment is assigned to the NEAREST code by vertical distance. Bounding
// by the neighbouring row instead would steal the last line of the row above,
// because a wrapped name extends both above and below its own code.

const ROW_BAND = 40

// Cells that sit in or beside the name column but are not part of a name.
// First Year rows carry "Required Prerequisite", "Prerequisite for" and a
// single-letter KSA mapping between the name and the marks, so a naive x-range
// swept them up: BSC11P came out as "NIL NIL S".
function isNameNoise(str: string): boolean {
  const t = str.trim().replace(/[$*#]/g, "")
  if (!t) return true
  if (/^(NIL|N\.?A\.?|-|–|as per|course|K|S|A|Y|T|P)$/i.test(t)) return true
  if (looksLikeCode(t)) return true // prerequisite columns hold course codes
  if (/^\d+$/.test(t)) return true
  return false
}

type Anchor = { code: string; y: number }

function nameFromColumn(
  glyphs: Glyph[],
  anchor: Anchor,
  anchors: Anchor[],
  nameX: { min: number; max: number }
): string {
  const mine = glyphs.filter((g) => {
    if (g.x < nameX.min || g.x > nameX.max) return false
    if (Math.abs(g.y - anchor.y) > ROW_BAND) return false
    if (isNameNoise(g.str)) return false
    // Nearest anchor wins: a fragment sitting between two codes belongs to
    // whichever row it is closer to.
    let best = anchor
    let bestD = Math.abs(g.y - anchor.y)
    for (const a of anchors) {
      const d = Math.abs(g.y - a.y)
      if (d < bestD) {
        best = a
        bestD = d
      }
    }
    return best.code === anchor.code
  })
  return (
    mine
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((g) => g.str)
      .join(" ")
      .replace(/\s+/g, " ")
      // The column header sits immediately above the first row and lands inside
      // its band.
      .replace(/^(Course\s+)?(Code\s+)?Name\s+/i, "")
      .trim()
  )
}

/**
 * Read names straight off the scheme table, for the codes whose detail page is
 * missing. Returns code -> name for whatever it can recover.
 */
export function namesFromSchemeTable(pages: Glyph[][]): Map<string, string> {
  const out = new Map<string, string>()

  for (const glyphs of pages) {
    // A course row is anchored by its code; the marks columns confirm the page
    // is a scheme table rather than prose that happens to contain a code.
    const anchors: Anchor[] = glyphs
      .filter((g) => looksLikeCode(g.str))
      .map((g) => ({
        code: g.str.trim().replace(/[$*#]/g, "").toUpperCase(),
        y: g.y,
      }))
    if (anchors.length < 3) continue

    const codeX = median(
      glyphs.filter((g) => looksLikeCode(g.str)).map((g) => g.x)
    )
    // The name column starts just right of the code column and ends where the
    // type/marks columns begin — the first column of short, mostly-numeric cells.
    // The name column ends where the first metadata or marks column begins.
    // On First Year pages that is the prerequisite column, not the numbers.
    const numericX = glyphs
      .filter((g) =>
        /^(\d{1,3}|-|–|NIL|Theory|Practical|Tutorial|[KSA])$/i.test(
          g.str.trim()
        )
      )
      .map((g) => g.x)
      .filter((x) => x > codeX + 10)
    if (numericX.length === 0) continue
    const nameX = { min: codeX + 8, max: Math.min(...numericX) - 4 }
    if (nameX.max <= nameX.min) continue

    for (const a of anchors) {
      if (out.has(a.code)) continue
      const name = nameFromColumn(glyphs, a, anchors, nameX)
      if (name.length >= 3) out.set(a.code, name)
    }
  }

  return out
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
