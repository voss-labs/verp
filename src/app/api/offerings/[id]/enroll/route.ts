import { NextRequest } from "next/server"
import { getSessionUser, isStaff } from "@/lib/session"
import { enrollStudent, unenrollStudent, createAuditLog } from "@/db/queries"
import { apiSuccess, apiError } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { z } from "zod"

const schema = z.object({
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
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid data", 400)
    }

    const result = await enrollStudent({
      courseOfferingId: id,
      studentId: parsed.data.studentId,
    })

    await createAuditLog({
      action: "enrollment.add",
      actorId: user.id,
      targetType: "courseOffering",
      targetId: id,
      details: { studentId: parsed.data.studentId },
    })

    return apiSuccess(result)
  } catch (err) {
    console.error("Failed to enroll student:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}

export async function DELETE(
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
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid data", 400)
    }

    const result = await unenrollStudent(id, parsed.data.studentId)
    if (!result) {
      return apiError("Enrollment not found", 404)
    }

    await createAuditLog({
      action: "enrollment.remove",
      actorId: user.id,
      targetType: "courseOffering",
      targetId: id,
      details: { studentId: parsed.data.studentId },
    })

    return apiSuccess({ success: true })
  } catch (err) {
    console.error("Failed to unenroll student:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}
