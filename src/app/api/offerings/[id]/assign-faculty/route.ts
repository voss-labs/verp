import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/session"
import { updateCourseOffering, createAuditLog } from "@/db/queries"
import { apiSuccess, apiError } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { z } from "zod"

const schema = z.object({
  facultyId: z.string().uuid().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user || user.role !== "admin") {
      return apiError("Forbidden", 403)
    }

    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid data", 400)
    }

    const result = await updateCourseOffering(id, {
      facultyId: parsed.data.facultyId,
    })
    if (!result) {
      return apiError("Offering not found", 404)
    }

    await createAuditLog({
      action: "offering.assign_faculty",
      actorId: user.id,
      targetType: "courseOffering",
      targetId: id,
      details: { facultyId: parsed.data.facultyId },
    })

    return apiSuccess({ success: true })
  } catch (err) {
    console.error("Failed to assign faculty:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}
