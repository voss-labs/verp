"use client"

import { useEffect, useState } from "react"
import { DrawerSection } from "@/components/record-drawer"
import { useCan } from "@/components/session-provider"
import {
  getRecordHistoryAction,
  type HistoryEvent,
} from "@/app/dashboard/audit/actions"

/**
 * What has happened to this record (spec 5.4).
 *
 * The global activity log answers "what happened today". It cannot answer "why
 * does this student's record look like this", because that means scrolling
 * thousands of unrelated rows. Same events, asked the other way round.
 *
 * Loaded when the drawer opens rather than with the table behind it: a roster
 * page would otherwise carry the audit trail of every student on it to render
 * one drawer.
 */
export function RecordHistory({
  targetType,
  targetId,
}: {
  targetType: string
  targetId: string | null
}) {
  const can = useCan()
  const allowed = can("audit:read")
  // Which record the loaded events belong to travels with them. Clearing them
  // separately when the drawer moves on would mean writing state during the
  // effect, and for one render the previous student's history would sit under
  // the new one's name.
  const [loaded, setLoaded] = useState<{
    forId: string
    events: HistoryEvent[] | null
  } | null>(null)

  useEffect(() => {
    if (!targetId || !allowed) return
    let live = true
    getRecordHistoryAction({ targetType, targetId }).then((res) => {
      if (!live) return
      setLoaded({ forId: targetId, events: res.error ? null : res.events })
    })
    return () => {
      live = false
    }
  }, [targetType, targetId, allowed])

  if (!allowed || !targetId) return null

  const current = loaded?.forId === targetId ? loaded : null
  const events = current?.events ?? null
  const failed = current != null && current.events === null

  return (
    <DrawerSection title="History">
      {failed ? (
        <p className="text-muted-foreground text-xs">
          Could not load the history for this record.
        </p>
      ) : current === null ? (
        <p className="text-muted-foreground text-xs">Loading…</p>
      ) : events === null || events.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Nothing recorded against this record yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id} className="text-xs">
              <p className="font-medium">{describe(e.action)}</p>
              <p className="text-muted-foreground">
                {e.actorName ?? "Unknown"} · {when(e.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </DrawerSection>
  )
}

/**
 * "identity.bound" is what the code calls it; "Signed in and linked" is what
 * happened. An unmapped action falls back to its raw string rather than being
 * hidden, because a missing entry in this map must not lose an event.
 */
const ACTION_LABEL: Record<string, string> = {
  "identity.bound": "Signed in and linked to this record",
  "faculty.created": "Added",
  "faculty.updated": "Details changed",
  "faculty.deactivated": "Deactivated",
  "faculty.role_changed": "Role changed",
  "student.updated": "Details changed",
  "student.deactivated": "Deactivated",
}

function describe(action: string) {
  return ACTION_LABEL[action] ?? action
}

/** Absolute date, because "3 days ago" is unusable evidence in a dispute. */
function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  })
}
