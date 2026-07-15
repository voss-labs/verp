import { NextRequest } from "next/server"
import { getSessionUser } from "@/lib/session"
import {
  lockMarks,
  unlockMarks,
  getMarksLock,
  createAuditLog,
} from "@/db/queries"
import { apiSuccess, apiError } from "@/lib/api-response"
import { getErrorMessage } from "@/lib/error-utils"
import { z } from "zod"

const schema = z.object({
  component: z.enum(["isa", "mse", "ese", "all"]),
  lock: z.boolean(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user || (user.role !== "admin" && user.role !== "faculty")) {
      return apiError("Forbidden", 403)
    }

    const { id } = await params
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError("Invalid data", 400)
    }

    const { component, lock } = parsed.data
    if (lock) {
      await lockMarks(id, component, user.id)
    } else {
      if (user.role !== "admin") {
        return apiError("Only admins can unlock marks", 403)
      }
      await unlockMarks(id, component, user.id)
    }

    await createAuditLog({
      action: lock ? "marks.lock" : "marks.unlock",
      actorId: user.id,
      targetType: "courseOffering",
      targetId: id,
      details: { component },
    })

    return apiSuccess({ success: true })
  } catch (err) {
    console.error("Failed to toggle lock:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return apiError("Unauthorized", 401)
    }

    const { id } = await params
    const locks = await Promise.all([
      getMarksLock(id, "isa"),
      getMarksLock(id, "mse"),
      getMarksLock(id, "ese"),
      getMarksLock(id, "all"),
    ])

    return apiSuccess({
      isa: locks[0]?.isLocked ?? false,
      mse: locks[1]?.isLocked ?? false,
      ese: locks[2]?.isLocked ?? false,
      all: locks[3]?.isLocked ?? false,
    })
  } catch (err) {
    console.error("Failed to get lock status:", err)
    return apiError(getErrorMessage(err, "Internal server error"), 500)
  }
}
