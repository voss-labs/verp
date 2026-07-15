import { looksLikeRoll } from "@/lib/roll-number"

// Client-safe. The browser re-runs applyMapping live as the faculty changes the
// column mapping; the server runs the same extract on upload. No I/O here.

// The four fields our marks schema stores, plus how a detected file column can
// map onto them. "mse_avg" writes the same value to mse1 and mse2 so the stored
// average round-trips — real marksheets hand us the average already, not the two
// halves. "skip" drops the column.
export type MarkTarget = "isa" | "mse_avg" | "mse1" | "mse2" | "ese" | "skip"

export type ExtractedRow = {
  rollNumber: string
  name: string
  // One entry per detected mark column, in column order. null = absent / blank /
  // an Excel error like #DIV/0! — anything that isn't a real number.
  marks: (number | null)[]
}

export type MappedMarks = {
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
}

// Tokens that stand in for "no mark": absent, Excel divide-by-zero, dashes.
const BLANK_TOKENS = new Set([
  "AB",
  "A",
  "ABS",
  "ABSENT",
  "#DIV/0!",
  "#N/A",
  "NA",
  "N/A",
  "-",
  "--",
])

// A token is a mark if it's a number or a known blank marker. Names never are.
function markValue(token: string): { isMark: boolean; value: number | null } {
  const t = token.trim()
  if (!t) return { isMark: false, value: null }
  if (BLANK_TOKENS.has(t.toUpperCase())) return { isMark: true, value: null }
  if (/^\d+(\.\d+)?$/.test(t)) return { isMark: true, value: Number(t) }
  return { isMark: false, value: null }
}

/**
 * Pull one student row out of a token list, anchored on the roll number. Works
 * for both a spreadsheet row (cells as tokens) and a PDF line (whitespace split):
 * find the roll token, take the alphabetic run after it as the name, and every
 * numeric / blank token after that as the marks. Sr No before the roll is ignored.
 * Returns null for any line without a roll (batch separators, headers, titles).
 */
export function extractRow(tokens: string[]): ExtractedRow | null {
  // Drop blank cells: xlsx pads every row with empty trailing cells, and PDF has
  // no blanks at all. A mark column is a token that reads as a number or an
  // absent-marker (AB); real marksheets never leave a mark cell truly empty, they
  // write AB or 0, so contiguous non-blank tokens preserve the columns.
  const cleaned = tokens.map((t) => t.trim()).filter(Boolean)
  const rollIdx = cleaned.findIndex((t) => looksLikeRoll(t))
  if (rollIdx < 0) return null

  const rollNumber = cleaned[rollIdx].toUpperCase()
  const after = cleaned.slice(rollIdx + 1)

  const nameParts: string[] = []
  const marks: (number | null)[] = []
  let inMarks = false
  for (const tok of after) {
    const { isMark, value } = markValue(tok)
    if (!inMarks && !isMark) {
      nameParts.push(tok)
      continue
    }
    inMarks = true
    // A stray alphabetic token once we're in the marks region is noise — skip it.
    if (isMark) marks.push(value)
  }

  return { rollNumber, name: nameParts.join(" ").trim(), marks }
}

/**
 * Extract every student row from a set of token-lists (PDF lines or sheet rows),
 * and normalise them to a common column count (the widest row wins — short rows
 * are padded with nulls so column N means the same thing on every row).
 */
export function extractRows(lines: string[][]): {
  rows: ExtractedRow[]
  columnCount: number
} {
  const rows = lines
    .map(extractRow)
    .filter((r): r is ExtractedRow => r !== null && r.marks.length > 0)
  const columnCount = rows.reduce((m, r) => Math.max(m, r.marks.length), 0)
  for (const r of rows) {
    while (r.marks.length < columnCount) r.marks.push(null)
  }
  return { rows, columnCount }
}

// Sum helper that stays null when every contributing column is null, so an empty
// ISA doesn't silently become 0.
function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0)
}

/**
 * Fold a row's detected mark columns into the four stored fields, using the
 * faculty's column→target mapping. Columns sharing a target are summed (ISA split
 * into TH + LAB); mse_avg fills both halves so the stored average is preserved.
 */
export function applyMapping(
  marks: (number | null)[],
  mapping: MarkTarget[]
): MappedMarks {
  const pick = (target: MarkTarget) =>
    marks.filter((_, i) => mapping[i] === target)

  const avg = sumOrNull(pick("mse_avg"))
  return {
    isa: sumOrNull(pick("isa")),
    ese: sumOrNull(pick("ese")),
    mse1: avg ?? sumOrNull(pick("mse1")),
    mse2: avg ?? sumOrNull(pick("mse2")),
  }
}

const TARGET_HINTS: { target: MarkTarget; patterns: RegExp[] }[] = [
  { target: "mse_avg", patterns: [/mse.*av/i, /\bav(g|erage)?\b/i] },
  { target: "isa", patterns: [/\bisa\b/i, /\btotal\b/i] },
  { target: "mse1", patterns: [/mse.*1/i] },
  { target: "mse2", patterns: [/mse.*2/i] },
  { target: "ese", patterns: [/\bese\b/i, /end.?sem/i] },
]

// A first-guess mapping from header text, if we found any. The faculty confirms
// or overrides it in the preview — this only saves clicks, it isn't trusted.
export function guessTargets(headers: string[]): MarkTarget[] {
  return headers.map((h) => {
    for (const { target, patterns } of TARGET_HINTS) {
      if (patterns.some((p) => p.test(h))) return target
    }
    return "skip"
  })
}
