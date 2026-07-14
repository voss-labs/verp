import { NextRequest } from "next/server"
import { getSessionUser, isStaff } from "@/lib/session"
import { bulkUpsertMarks, getMarksLock, createAuditLog } from "@/db/queries"
import { apiSuccess, apiError } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { z } from "zod"

export const dynamic = "force-dynamic"

const marksEntrySchema = z.object({
  courseOfferingId: z.string().uuid(),
  marks: z.array(
    z.object({
      studentId: z.string().uuid(),
      isa: z.number().int().min(0).nullable(),
      mse1: z.number().int().min(0).nullable(),
      mse2: z.number().int().min(0).nullable(),
      ese: z.number().int().min(0).nullable(),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!isStaff(user)) {
      return apiError("Forbidden", 403)
    }

    const body = await req.json()
    const parsed = marksEntrySchema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid marks data", 400)
    }

    const { courseOfferingId, marks } = parsed.data

    const allLock = await getMarksLock(courseOfferingId, "all")
    if (allLock?.isLocked && user.role !== "admin") {
      return apiError("Marks are locked", 403)
    }

    const entries = marks.map((m) => ({
      courseOfferingId,
      studentId: m.studentId,
      isa: m.isa,
      mse1: m.mse1,
      mse2: m.mse2,
      ese: m.ese,
    }))

    const result = await bulkUpsertMarks(entries)

    await createAuditLog({
      action: "marks.save",
      actorId: user.id,
      targetType: "courseOffering",
      targetId: courseOfferingId,
      details: { count: result.length },
    })

    return apiSuccess({ saved: result.length })
  } catch (err) {
    console.error("Failed to save marks:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}
