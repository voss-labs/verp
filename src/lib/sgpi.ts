export type MarksInput = {
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
}

export type CourseInfo = {
  courseType: string
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
}

export type ComputedMarks = {
  finalMse: number | null
  total: number
  percentage: number | null
  gradePoint: number | "Fail" | null
  status: "pass" | "fail" | null
  creditPoints: number | null
}

export function computeMarks(
  marks: MarksInput,
  course: CourseInfo
): ComputedMarks {
  const hasMse = course.maxMse > 0
  const finalMse =
    hasMse && marks.mse1 != null && marks.mse2 != null
      ? Math.round((marks.mse1 + marks.mse2) / 2)
      : hasMse
        ? null
        : 0

  const isa = marks.isa ?? 0
  const mse = finalMse ?? 0
  const ese = marks.ese ?? 0
  const total = isa + mse + ese

  const hasAllMarks =
    marks.isa != null && (!hasMse || finalMse != null) && marks.ese != null

  if (!hasAllMarks) {
    return {
      finalMse,
      total,
      percentage: null,
      gradePoint: null,
      status: null,
      creditPoints: null,
    }
  }

  const percentage = Math.round((total / course.maxTotal) * 100 * 10) / 10
  const gradePoint = getGradePoint(percentage)
  const status = percentage >= 40 ? ("pass" as const) : ("fail" as const)
  const creditPoints =
    typeof gradePoint === "number" ? gradePoint * course.credits : null

  return { finalMse, total, percentage, gradePoint, status, creditPoints }
}

export function getGradePoint(pct: number): number | "Fail" {
  if (pct >= 80) return 10
  if (pct >= 75) return 9
  if (pct >= 70) return 8
  if (pct >= 60) return 7
  if (pct >= 50) return 6
  if (pct >= 45) return 5
  if (pct >= 40) return 4
  return "Fail"
}

export type SgpiResult = {
  totalCreditPoints: number
  totalCredits: number
  sgpi: number | null
  hasFail: boolean
}

export function computeSgpi(
  entries: { marks: MarksInput; course: CourseInfo }[]
): SgpiResult {
  let totalCreditPoints = 0
  let totalCredits = 0
  let hasFail = false

  for (const { marks, course } of entries) {
    const computed = computeMarks(marks, course)

    // An ungraded subject is "not yet", not zero. Counting its credits while it
    // can contribute no credit points divides by a denominator the student has
    // not had the chance to earn against — mid-term, that reported SGPI 0 for a
    // class whose ESE simply had not happened yet.
    if (computed.gradePoint == null) continue

    totalCredits += course.credits
    if (computed.status === "fail" || computed.gradePoint === "Fail") {
      hasFail = true
    } else if (computed.creditPoints != null) {
      totalCreditPoints += computed.creditPoints
    }
  }

  const sgpi =
    totalCredits > 0
      ? Math.round((totalCreditPoints / totalCredits) * 100) / 100
      : null

  return { totalCreditPoints, totalCredits, sgpi, hasFail }
}

// ── CGPA across semesters ──────────────────────────────────────────────────
//
// Lifted out of the pre-reset SGPI page, where it lived inside a client
// component and could only ever serve that one screen. It is pure arithmetic
// over computeSgpi, so it belongs beside it — the student's own view and the
// staff console now compute identically instead of drifting apart.
//
// The old version keyed semesters by (number, academicYear) because offerings
// hung off an academic_years table. Cohort identity now lives in the class key,
// so a bare semester number is enough.

export type SemesterEntries = {
  semester: number
  entries: { marks: MarksInput; course: CourseInfo }[]
}

export type SemesterResult = {
  semester: number
  sgpi: SgpiResult
}

export type CgpaResult = {
  cgpa: number | null
  totalCredits: number
  totalCreditPoints: number
  hasFail: boolean
  /** Semesters with a computable SGPI — an in-progress term contributes none. */
  completedSemesters: number
  perSemester: SemesterResult[]
}

export function computeCgpa(semesters: SemesterEntries[]): CgpaResult {
  let totalCredits = 0
  let totalCreditPoints = 0
  let hasFail = false
  let completedSemesters = 0
  const perSemester: SemesterResult[] = []

  for (const sem of [...semesters].sort((a, b) => a.semester - b.semester)) {
    const sgpi = computeSgpi(sem.entries)
    perSemester.push({ semester: sem.semester, sgpi })
    totalCredits += sgpi.totalCredits
    totalCreditPoints += sgpi.totalCreditPoints
    if (sgpi.hasFail) hasFail = true
    if (sgpi.sgpi != null) completedSemesters++
  }

  const cgpa =
    totalCredits > 0
      ? Math.round((totalCreditPoints / totalCredits) * 100) / 100
      : null

  return {
    cgpa,
    totalCredits,
    totalCreditPoints,
    hasFail,
    completedSemesters,
    perSemester,
  }
}

/** Group flat marks rows into the per-semester shape computeCgpa expects. */
export function groupBySemester(
  rows: { semester: number; marks: MarksInput; course: CourseInfo }[]
): SemesterEntries[] {
  const bySem = new Map<number, { marks: MarksInput; course: CourseInfo }[]>()
  for (const r of rows) {
    const list = bySem.get(r.semester) ?? []
    list.push({ marks: r.marks, course: r.course })
    bySem.set(r.semester, list)
  }
  return [...bySem.entries()].map(([semester, entries]) => ({
    semester,
    entries,
  }))
}
