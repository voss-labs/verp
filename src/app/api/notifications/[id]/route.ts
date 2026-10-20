import { apiError, apiSuccess } from "@/lib/api-response"
import { getSessionUser } from "@/lib/session"
import { markNotificationRead } from "@/db/queries/notifications"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return apiError("Unauthorized", 401)
  const { id } = await params
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id))
    return apiError("Invalid notification id", 400)
  const row = await markNotificationRead(id, user.id)
  return row ? apiSuccess(row) : apiError("Notification not found", 404)
}
