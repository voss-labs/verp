"use server"

import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { getRecordHistory } from "@/db/queries/audit"

export type HistoryEvent = {
  id: string
  action: string
  actorName: string | null
  createdAt: string
  details: Record<string, unknown> | null
}

/**
 * The recent history of one record, for a drawer that has just been opened.
 *
 * Fetched on demand rather than with the table: a roster page would otherwise
 * carry the audit trail of every student on it to render one drawer. The
 * capability is checked here and not only where the section renders — hiding a
 * component is a UI decision, and this is a server action anyone can call.
 */
export async function getRecordHistoryAction(input: {
  targetType: string
  targetId: string
}): Promise<{ events: HistoryEvent[]; error: string | null }> {
  try {
    const user = await getSessionUser()
    if (!user || !can(user, "audit:read")) {
      return { events: [], error: "Not permitted." }
    }
    const rows = await getRecordHistory(input.targetType, input.targetId)
    return {
      events: rows.map((r) => ({
        id: r.id,
        action: r.action,
        actorName: r.actorName,
        createdAt: r.createdAt.toISOString(),
        details: r.details as Record<string, unknown> | null,
      })),
      error: null,
    }
  } catch {
    return { events: [], error: "Could not load history." }
  }
}
