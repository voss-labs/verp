import { NextRequest } from "next/server"
import { z } from "zod"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { getSessionUser } from "@/lib/session"
import { computeSgpi, type CourseInfo, type MarksInput } from "@/lib/sgpi"
import {
  bulkGraduateStudents,
  bulkPromoteStudents,
  createAuditLog,
  getAllMarksBySemester,
  getAllSemesters,
  getCurrentSemester,
  getStudentsByYearSemester,
} from "@/db/queries"

export const dynamic = "force-dynamic"

const promoteSchema = z.object({
  sourceYear: z.enum(["FE", "SE", "TE", "BE"]),
  sourceSemester: z.string().min(1),
  targetYear: z.enum(["FE", "SE", "TE", "BE"]),
  targetSemester: z.string().min(1),
  requirePass: z.boolean().optional().default(false),
  action: z
    .enum(["preview", "promote", "graduate"])
    .optional()
    .default("preview"),
})

const YEAR_ORDER = ["FE", "SE", "TE", "BE"] as const
const YEAR_SEMESTERS: Record<string, string[]> = {
  FE: ["1", "2"],
  SE: ["3", "4"],
  TE: ["5", "6"],
  BE: ["7", "8"],
}

type PreviewRow = {
  id: string
  rollNumber: string
  name: string
  year: string
  semester: string | null
  sgpi: number | null
  status: "pass" | "fail" | "incomplete"
  eligible: boolean
  reason: string
}

type SemesterMark = Awaited<ReturnType<typeof getAllMarksBySemester>>[number]

function computeStudentSgpi(marksList: SemesterMark[]) {
  if (marksList.length === 0) {
    return { sgpi: null, hasFail: false }
  }

  const entries = marksList.map((m) => ({
    marks: {
      isa: m.isa,
      mse1: m.mse1,
      mse2: m.mse2,
      ese: m.ese,
    } as MarksInput,
    course: {
      courseType: m.courseOffering.course.courseType,
      credits: m.courseOffering.course.credits,
      maxIsa: m.courseOffering.course.maxIsa,
      maxMse: m.courseOffering.course.maxMse,
      maxEse: m.courseOffering.course.maxEse,
      maxTotal: m.courseOffering.course.maxTotal,
    } as CourseInfo,
  }))

  return computeSgpi(entries)
}

function getTargetFor(sourceYear: string, sourceSemester: string) {
  const sem = Number.parseInt(sourceSemester, 10)
  if (Number.isNaN(sem)) return null
  const nextSem = sem + 1

  if (nextSem % 2 === 0) {
    return { year: sourceYear, semester: String(nextSem) }
  }

  const idx = YEAR_ORDER.indexOf(sourceYear as (typeof YEAR_ORDER)[number])
  if (idx === -1 || idx === YEAR_ORDER.length - 1) return null

  return { year: YEAR_ORDER[idx + 1], semester: String(nextSem) }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== "admin") {
      return apiError("Forbidden", 403)
    }

    const body = await req.json()
    const parsed = promoteSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid data", 400)
    }

    const {
      sourceYear,
      sourceSemester,
      targetYear,
      targetSemester,
      requirePass,
      action,
    } = parsed.data

    const isGraduation = sourceYear === "BE" && sourceSemester === "8"

    if (action === "graduate" && !isGraduation) {
      return apiError("Graduation is only allowed for BE Sem 8", 400)
    }

    if (
      !isGraduation &&
      sourceYear === targetYear &&
      sourceSemester === targetSemester
    ) {
      return apiError("Source and target cannot be the same", 400)
    }

    const validSourceSemesters = YEAR_SEMESTERS[sourceYear] ?? []
    if (!validSourceSemesters.includes(sourceSemester)) {
      return apiError("Invalid source year/semester", 400)
    }

    const targetOption = getTargetFor(sourceYear, sourceSemester)
    if (!targetOption && !isGraduation) {
      return apiError("Invalid promotion target", 400)
    }
    if (isGraduation) {
      if (targetYear !== sourceYear || targetSemester !== sourceSemester) {
        return apiError("Target must match source for graduation", 400)
      }
    } else if (
      targetYear !== targetOption?.year ||
      targetSemester !== targetOption?.semester
    ) {
      return apiError("Target year/semester must be the next valid semester", 400)
    }

    const sourceSemesterNumber = Number.parseInt(sourceSemester, 10)
    if (Number.isNaN(sourceSemesterNumber)) {
      return apiError("Invalid source semester", 400)
    }

    const students = await getStudentsByYearSemester({
      year: sourceYear,
      semester: sourceSemester,
    })

    let semesterId: number | null = null
    const currentSemester = await getCurrentSemester()
    if (currentSemester && currentSemester.number === sourceSemesterNumber) {
      semesterId = currentSemester.id
    } else {
      const semesters = await getAllSemesters()
      const match = semesters
        .filter((s) => s.number === sourceSemesterNumber)
        .sort((a, b) => b.id - a.id)[0]
      semesterId = match?.id ?? null
    }

    const studentIds = students.map((s) => s.id)
    const idSet = new Set(studentIds)

    const marksByStudent = new Map<string, SemesterMark[]>()
    let allMarks: SemesterMark[] = []

    if (semesterId) {
      allMarks = await getAllMarksBySemester(semesterId)
      for (const mark of allMarks) {
        if (!idSet.has(mark.studentId)) continue
        const list = marksByStudent.get(mark.studentId) ?? []
        list.push(mark)
        marksByStudent.set(mark.studentId, list)
      }
    }

    const previewRows: PreviewRow[] = students.map((student) => {
      const marksList = marksByStudent.get(student.id) ?? []
      const sgpi = computeStudentSgpi(marksList)
      let status: PreviewRow["status"] = "incomplete"
      if (sgpi.sgpi != null && !sgpi.hasFail) status = "pass"
      else if (sgpi.hasFail) status = "fail"

      const alreadyTarget =
        !isGraduation &&
        student.year === targetYear &&
        (student.semester ?? "") === targetSemester

      let eligible = !alreadyTarget
      let reason = alreadyTarget ? "already-target" : "eligible"

      if (requirePass && status !== "pass") {
        eligible = false
        reason = status === "fail" ? "failed" : "incomplete"
      }

      return {
        id: student.id,
        rollNumber: student.rollNumber,
        name: `${student.firstName} ${student.lastName}`,
        year: student.year,
        semester: student.semester,
        sgpi: sgpi.sgpi,
        status,
        eligible,
        reason,
      }
    })

    const counts = {
      total: previewRows.length,
      eligible: previewRows.filter((r) => r.eligible).length,
      failed: previewRows.filter((r) => r.reason === "failed").length,
      incomplete: previewRows.filter((r) => r.reason === "incomplete").length,
      alreadyTarget: previewRows.filter((r) => r.reason === "already-target")
        .length,
    }

    if (action === "preview") {
      return apiSuccess({
        preview: true,
        counts,
        students: previewRows,
      })
    }

    const promoteIds = previewRows.filter((r) => r.eligible).map((r) => r.id)
    const updated = isGraduation
      ? await bulkGraduateStudents({
          studentIds: promoteIds,
          sourceYear,
          sourceSemester,
        })
      : await bulkPromoteStudents({
          studentIds: promoteIds,
          sourceYear,
          sourceSemester,
          targetYear,
          targetSemester,
        })

    if (updated.length > 0) {
      await createAuditLog({
        action: isGraduation ? "students.graduate" : "students.promote",
        actorId: user.id,
        targetType: "students",
        details: {
          sourceYear,
          sourceSemester,
          targetYear,
          targetSemester,
          requirePass,
          total: counts.total,
          promoted: updated.length,
          skipped: counts.total - updated.length,
        },
      })
    }

    return apiSuccess({
      preview: false,
      counts: {
        ...counts,
        promoted: updated.length,
      },
    })
  } catch (err) {
    console.error("Failed to promote students:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}
