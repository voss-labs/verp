import { apiError, apiSuccess } from "@/lib/api-response"
import { getSessionUser } from "@/lib/session"
import { listNotifications } from "@/db/queries/notifications"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return apiError("Unauthorized", 401)
  return apiSuccess(await listNotifications(user.id))
}
