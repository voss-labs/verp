import { normalizeHeader } from "@/lib/xlsx-import"

// Client-safe. Parses a faculty CSV into validated preview rows the HOD confirms
// before commit. Only the fields VERP needs to create a staff member — the class
// role is chosen once in the UI, not per row.

export type FacultyRow = {
  firstName: string
  lastName: string
  email: string
  employeeId: string
  flags: string[]
}

const SYNONYMS: Record<keyof Omit<FacultyRow, "flags"> | "name", string[]> = {
  firstName: ["firstname", "fname", "givenname"],
  lastName: ["lastname", "surname", "lname"],
  name: ["name", "fullname", "facultyname", "staffname"],
  email: ["email", "emailid", "mail", "emailaddress"],
  employeeId: ["employeeid", "empid", "employeecode", "staffid", "id", "code"],
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// A minimal RFC-4180 CSV reader: handles quoted fields, escaped quotes ("")
// and both \n and \r\n line breaks. Enough for the staff lists HODs export.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      rows.push(row)
      field = ""
      row = []
    } else field += c
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

// Map each header column to a faculty field (or null) by normalized synonym match.
function mapColumns(headers: string[]): (keyof typeof SYNONYMS | null)[] {
  const taken = new Set<string>()
  return headers.map((raw) => {
    const h = normalizeHeader(raw)
    if (!h) return null
    for (const [field, syns] of Object.entries(SYNONYMS)) {
      if (taken.has(field)) continue
      if (syns.some((s) => h === s || h.includes(s) || s.includes(h))) {
        taken.add(field)
        return field as keyof typeof SYNONYMS
      }
    }
    return null
  })
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

// Turn a parsed grid (header row + data) into validated preview rows. The header
// is the first row that maps to at least an email or a name column; anything
// before it (title/blank rows) is skipped.
export function buildFacultyRows(grid: string[][]): FacultyRow[] {
  const headerIdx = grid.findIndex((r) => {
    const m = mapColumns(r)
    return m.includes("email") || m.includes("name") || m.includes("firstName")
  })
  if (headerIdx < 0) return []

  const mapping = mapColumns(grid[headerIdx])
  const col = (field: string) => mapping.indexOf(field as keyof typeof SYNONYMS)
  const cell = (cells: string[], field: string) => {
    const i = col(field)
    return i >= 0 ? (cells[i] ?? "").trim() : ""
  }

  return grid.slice(headerIdx + 1).map((cells): FacultyRow => {
    let firstName = cell(cells, "firstName")
    let lastName = cell(cells, "lastName")
    if (!firstName && !lastName) {
      const s = splitName(cell(cells, "name"))
      firstName = s.firstName
      lastName = s.lastName
    }
    const email = cell(cells, "email").toLowerCase()
    const employeeId = cell(cells, "employeeId")

    const flags: string[] = []
    if (!firstName) flags.push("Missing name")
    if (!email) flags.push("Missing email")
    else if (!EMAIL_RE.test(email)) flags.push("Invalid email")
    if (!employeeId) flags.push("Missing employee ID")

    return { firstName, lastName, email, employeeId, flags }
  })
}
