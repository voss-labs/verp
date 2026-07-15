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
