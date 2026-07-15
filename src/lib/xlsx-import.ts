import { parseRollNumber, expectedYear, type Year } from "@/lib/roll-number"

// The roster fields we ingest. Deliberately only what VERP does NOT compute —
// no marks, no SGPI/CGPA, no attendance. Those have a single source of truth
// (VERP itself) and importing them would create a second, conflicting one.
export type StudentField =
  | "rollNumber"
  | "firstName"
  | "lastName"
  | "name"
  | "email"
  | "department"
  | "division"
  | "year"
  | "semester"
  | "phoneNo"

// What a TR's column might be called. The mapper is intentionally dumb — a
// normalize + synonym match — because the editable preview is the real error
// correction. A clever mapper that is occasionally confidently wrong is worse
// than a simple one the TR verifies.
const SYNONYMS: Record<StudentField, string[]> = {
  rollNumber: [
    "rollnumber",
    "rollno",
    "roll",
    "prn",
    "enrollmentno",
    "enrollment",
  ],
  firstName: ["firstname", "fname", "givenname"],
  lastName: ["lastname", "surname", "lname"],
  name: ["name", "fullname", "studentname"],
  email: [
    "email",
    "emailid",
    "mail",
    "emailaddress",
    "vitemail",
    "collegeemail",
  ],
  department: ["department", "dept", "branch"],
  division: ["division", "div", "class", "section"],
  year: ["year", "yr", "academicyear"],
  semester: ["semester", "sem"],
  phoneNo: ["phone", "phoneno", "mobile", "mobileno", "contact", "contactno"],
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      )
    }
  }
  return d[m][n]
}

/**
 * Map spreadsheet headers to student fields. Returns, per column index, the
 * field it maps to (or null). A header matches a field if the normalized header
 * exactly equals, contains, or is within edit-distance 1 of any synonym.
 */
export function mapColumns(headers: string[]): (StudentField | null)[] {
  const taken = new Set<StudentField>()

  return headers.map((raw) => {
    const h = normalizeHeader(raw)
    if (!h) return null

    let best: { field: StudentField; score: number } | null = null

    for (const [field, syns] of Object.entries(SYNONYMS) as [
      StudentField,
      string[],
    ][]) {
      if (taken.has(field)) continue
      for (const syn of syns) {
        let score = -1
        if (h === syn) score = 3
        else if (h.includes(syn) || syn.includes(h)) score = 2
        else if (levenshtein(h, syn) <= 1) score = 1
        if (score > (best?.score ?? 0)) best = { field, score }
      }
    }

    if (best) {
      taken.add(best.field)
      return best.field
    }
    return null
  })
}

export type CellFlag = { field: string; message: string }

export type PreviewRow = {
  rollNumber: string
  firstName: string
  lastName: string
  email: string
  department: string
  division: string
  year: string
  semester: string
  phoneNo: string
  // Per-row problems the TR must resolve before commit. Empty = clean.
  flags: CellFlag[]
}

const YEARS: Year[] = ["FE", "SE", "TE", "BE"]
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Split a single "name" cell when the sheet has no separate first/last columns.
// Naive first-token/rest split; the preview lets the TR correct it, which is the
// only honest way to handle the genuine ambiguity of Indian name ordering.
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export type RosterFields = Omit<PreviewRow, "flags">

/**
 * The per-row validator. Checks the schema AND cross-checks the row against its
 * own roll number — the roll number encodes branch and division, so a
 * Department/Division that disagrees with it is a typo. Also fills department /
 * division FROM the roll number when the sheet omitted them.
 *
 * Pure and client-safe (imports only the roll-number parser), so the browser
 * re-runs it live as the TR edits, and the server runs it on preview.
 */
export function flagRow(input: RosterFields, now: Date): PreviewRow {
  const row: PreviewRow = {
    ...input,
    rollNumber: input.rollNumber.trim().toUpperCase(),
    email: input.email.trim().toLowerCase(),
    division: input.division.trim().toUpperCase(),
    year: input.year.trim().toUpperCase(),
    flags: [],
  }
  const flags: CellFlag[] = []

  if (!row.rollNumber) flags.push({ field: "rollNumber", message: "Missing" })
  if (!row.firstName.trim())
    flags.push({ field: "firstName", message: "Missing" })
  if (!row.email) flags.push({ field: "email", message: "Missing" })
  else if (!EMAIL_RE.test(row.email))
    flags.push({ field: "email", message: "Not a valid email" })

  if (row.rollNumber) {
    try {
      const parsed = parseRollNumber(row.rollNumber)
      // Only fill/cross-check department when the roll's branch code is known.
      // Unknown code -> parsed.department is null, and the TR fills it manually.
      if (parsed.department) {
        if (!row.department) row.department = parsed.department
        else if (row.department.toUpperCase() !== parsed.department)
          flags.push({
            field: "department",
            message: `Roll says ${parsed.department}`,
          })
      }

      if (!row.division) row.division = parsed.division
      else if (row.division !== parsed.division)
        flags.push({
          field: "division",
          message: `Roll says division ${parsed.division}`,
        })

      const exp = expectedYear(parsed.admissionYear, now)
      if (row.year && exp && row.year !== exp)
        flags.push({
          field: "year",
          message: `Expected ${exp} by admission year`,
        })
    } catch (e) {
      flags.push({
        field: "rollNumber",
        message: e instanceof Error ? e.message : "Invalid roll number",
      })
    }
  }

  if (row.year && !YEARS.includes(row.year as Year))
    flags.push({ field: "year", message: "Expected FE / SE / TE / BE" })

  row.flags = flags
  return row
}

/**
 * Turn a mapped grid into validated preview rows. Splits a single "name" column
 * when there are no separate first/last columns, then delegates each row to
 * flagRow.
 */
export function buildPreviewRows(
  headers: string[],
  grid: string[][],
  now: Date
): { mapping: (StudentField | null)[]; rows: PreviewRow[] } {
  const mapping = mapColumns(headers)
  const col = (field: StudentField) => mapping.indexOf(field)

  const rows = grid.map((cells): PreviewRow => {
    const get = (field: StudentField) => {
      const i = col(field)
      return i >= 0 ? (cells[i] ?? "").toString().trim() : ""
    }

    let firstName = get("firstName")
    let lastName = get("lastName")
    if (!firstName && !lastName) {
      const split = splitName(get("name"))
      firstName = split.firstName
      lastName = split.lastName
    }

    return flagRow(
      {
        rollNumber: get("rollNumber"),
        firstName,
        lastName,
        email: get("email"),
        department: get("department"),
        division: get("division"),
        year: get("year"),
        semester: get("semester"),
        phoneNo: get("phoneNo"),
      },
      now
    )
  })

  return { mapping, rows }
}
