import { and, count, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { notifications, user } from "@/db/schema"

export type NewNotification = {
  title: string
  message: string
  type: "info" | "warning" | "action"
}

export async function notifyUsers(
  userIds: (string | null | undefined)[],
  item: NewNotification
) {
  const recipients = [...new Set(userIds.filter((id): id is string => !!id))]
  if (!recipients.length) return
  try {
    await db
      .insert(notifications)
      .values(recipients.map((userId) => ({ ...item, userId })))
  } catch (error) {
    console.error("[Notifications] Could not create notifications", error)
  }
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFICATION_FROM_EMAIL
  if (!apiKey || !from) return
  try {
    const users = await db
      .select({ email: user.email })
      .from(user)
      .where(inArray(user.id, recipients))
    await Promise.all(
      users.map(async ({ email }) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [email],
            subject: item.title,
            text: item.message,
          }),
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) {
          console.error(
            `[Notifications] Email delivery failed (${response.status})`
          )
        }
      })
    )
  } catch (error) {
    console.error("[Notifications] Could not send email notifications", error)
  }
}

export async function listNotifications(userId: string) {
  const [items, [{ value: unreadCount }]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(25),
    db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.read, false))
      ),
  ])
  return { items, unreadCount }
}

export async function markNotificationRead(id: string, userId: string) {
  const [row] = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id })
  return row
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
}
