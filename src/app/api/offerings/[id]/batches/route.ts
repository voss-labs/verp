import { NextRequest } from "next/server"
import { getSessionUser, isStaff } from "@/lib/session"
import { createBatch, assignStudentToBatch, createAuditLog } from "@/db/queries"
import { apiSuccess, apiError } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(20),
})

const assignSchema = z.object({
  batchId: z.string().uuid(),
  studentId: z.string().uuid(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!isStaff(user)) {
      return apiError("Forbidden", 403)
    }

    const { id } = await params
    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid data", 400)
    }

    const result = await createBatch({
      courseOfferingId: id,
      name: parsed.data.name,
    })

    await createAuditLog({
      action: "batch.create",
      actorId: user.id,
      targetType: "courseOffering",
      targetId: id,
      details: { batchName: parsed.data.name },
    })

    return apiSuccess(result)
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return apiError("Batch name already exists", 409)
    }
    console.error("Failed to create batch:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!isStaff(user)) {
      return apiError("Forbidden", 403)
    }

    const { id } = await params
    const body = await req.json()
    const parsed = assignSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid data", 400)
    }

    const result = await assignStudentToBatch({
      batchId: parsed.data.batchId,
      studentId: parsed.data.studentId,
    })

    await createAuditLog({
      action: "batch.assign_student",
      actorId: user.id,
      targetType: "batch",
      targetId: parsed.data.batchId,
      details: { studentId: parsed.data.studentId, courseOfferingId: id },
    })

    return apiSuccess(result)
  } catch (err) {
    console.error("Failed to assign student to batch:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}
