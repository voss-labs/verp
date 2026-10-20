import { apiError, apiSuccess } from "@/lib/api-response"
import { getSessionUser } from "@/lib/session"
import { markAllNotificationsRead } from "@/db/queries/notifications"

export async function POST() {
  const user = await getSessionUser()
  if (!user) return apiError("Unauthorized", 401)
  await markAllNotificationsRead(user.id)
  return apiSuccess({ success: true })
}
