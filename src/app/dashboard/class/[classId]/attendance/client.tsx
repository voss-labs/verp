"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { saveAttendanceAction } from "../../actions"

// The schema has no "unmarked" value: an unmarked student is simply a row that
// does not exist yet. Null models that here so the difference between "absent"
// and "nobody has said" survives all the way to the save.
type Status = "present" | "absent" | "late" | "excused"
type Mark = Status | null

const STATUSES: Status[] = ["present", "absent", "late", "excused"]
const STATUS_STYLE: Record<Status, string> = {
  present: "bg-green-600 text-white",
  absent: "bg-destructive text-white",
  late: "bg-amber-600 text-white",
  excused: "bg-muted-foreground text-white",
}
type Student = {
  id: string
  name: string
  rollNumber: string
  status: Mark
}

type Offering = { id: string; code: string; name: string }

export function AttendanceClient({
  classId,
  date,
  slot,
  offeringId,
  offerings,
  students,
}: {
  classId: string
  date: string
  slot: string
  offeringId: string | null
  offerings: Offering[]
  students: Student[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [marks, setMarks] = useState<Record<string, Mark>>(
    Object.fromEntries(students.map((s) => [s.id, s.status]))
  )
  const [filter, setFilter] = useState<"all" | Status | "unmarked">("all")

  // Only fills the gaps. A blanket "all present" is how a register gets taken
  // without being read; this leaves deliberate marks alone and says how many it
  // is about to touch.
  const markRemaining = (status: Status) =>
    setMarks((m) =>
      Object.fromEntries(students.map((s) => [s.id, m[s.id] ?? status]))
    )

  // Date, slot and subject together identify the session, so changing any of
  // them navigates rather than mutating what is on screen: a half-marked
  // register must not silently become another session's.
  const go = (next: {
    date?: string
    slot?: string
    offering?: string | null
  }) => {
    const d = next.date ?? date
    const s = next.slot ?? slot
    const o = next.offering === undefined ? offeringId : next.offering
    const q = new URLSearchParams({ date: d, slot: s })
    if (o) q.set("offering", o)
    router.push(`/dashboard/class/${classId}/attendance?${q}`)
  }

  const markedCount = students.filter((s) => marks[s.id] != null).length
  const remaining = students.length - markedCount
  const countOf = (v: Status) =>
    students.filter((s) => marks[s.id] === v).length
  const visible = students.filter((s) => {
    if (filter === "all") return true
    if (filter === "unmarked") return marks[s.id] == null
    return marks[s.id] === filter
  })

  function save() {
    start(async () => {
      const res = await saveAttendanceAction({
        classId,
        sessionDate: date,
        sessionSlot: slot,
        offeringId,
        // Only what somebody actually marked. Sending the unmarked as present
        // is what produced a full register from an untouched page.
        marks: students
          .filter((s) => marks[s.id] != null)
          .map((s) => ({ studentId: s.id, status: marks[s.id] as Status })),
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Attendance saved")
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            className="h-9 w-44"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">Session</label>
          <select
            value={offeringId ?? ""}
            onChange={(e) => go({ offering: e.target.value || null })}
            className="border-input bg-background h-9 rounded border px-2 text-sm"
          >
            {/* A register with no subject is the homeroom one. Naming it keeps
                it distinct from a subject whose register has not been taken. */}
            <option value="">Class session (no subject)</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} — {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={remaining === 0}
            onClick={() => {
              if (
                window.confirm(
                  `Mark the remaining ${remaining} student${remaining === 1 ? "" : "s"} present? Students you have already marked are left alone.`
                )
              ) {
                markRemaining("present")
              }
            }}
          >
            Mark remaining present
          </Button>
          <Button
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={pending || markedCount === 0}
            onClick={save}
          >
            {pending ? "Saving…" : `Save ${markedCount}`}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-xs">
          {markedCount} of {students.length} marked
          {remaining > 0 && (
            <span className="text-amber-600">
              {" "}
              · {remaining} still unmarked
            </span>
          )}
        </p>
        <div className="ml-auto flex flex-wrap gap-1">
          {(
            [
              ["all", `All ${students.length}`],
              ["unmarked", `Unmarked ${remaining}`],
              ...STATUSES.map((v) => [v, `${v} ${countOf(v)}`] as const),
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key as typeof filter)}
              className={cn(
                "rounded border px-2.5 py-1.5 text-xs capitalize transition-colors sm:py-0.5",
                filter === key
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No students in this class yet.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No students match that filter.
        </p>
      ) : (
        <div className="border-border overflow-hidden rounded border">
          <ul className="divide-border divide-y">
            {visible.map((s) => {
              const status = marks[s.id]
              return (
                // A register is taken standing up, on a phone, while looking
                // at the room. On a narrow screen the four buttons get a row of
                // their own under the name rather than being squeezed beside
                // it, and each is tall enough to hit without aiming.
                <li
                  key={s.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {s.rollNumber}
                    </Badge>
                    <span className="text-sm">{s.name}</span>
                    {status == null && (
                      <span className="ml-auto text-xs text-amber-600 sm:hidden">
                        Unmarked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {status == null && (
                      <span className="hidden text-xs text-amber-600 sm:inline">
                        Unmarked
                      </span>
                    )}
                    <div className="grid w-full grid-cols-4 overflow-hidden rounded border sm:flex sm:w-auto">
                      {STATUSES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={status === v}
                          // Pressing the current value clears it, so a mark made
                          // by mistake can be taken back to unmarked rather than
                          // forced into being one of the other four.
                          onClick={() =>
                            setMarks((m) => ({
                              ...m,
                              [s.id]: m[s.id] === v ? null : v,
                            }))
                          }
                          className={cn(
                            "min-h-11 px-3 text-xs font-medium capitalize transition-colors sm:min-h-0 sm:py-1",
                            status === v
                              ? STATUS_STYLE[v]
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
