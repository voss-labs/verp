"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FlaskConicalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import { WHOLE_CLASS } from "@/lib/attendance"
import { saveAttendanceAction } from "../../actions"

// The schema has no "unmarked" value: an unmarked student is simply a row that
// does not exist yet. Null models that here so the difference between "absent"
// and "nobody has said" survives all the way to the save.
type Status = "present" | "absent" | "late" | "excused"
type Mark = Status | null

const STATUSES: Status[] = ["present", "absent", "late", "excused"]
const KEY_STATUS: Record<string, Status> = {
  "1": "present",
  "2": "absent",
  "3": "late",
  "4": "excused",
}
const STATUS_STYLE: Record<Status, string> = {
  present: "bg-success text-success-foreground",
  absent: "bg-destructive text-white dark:text-background",
  late: "bg-attention text-attention-foreground",
  excused: "bg-muted-foreground text-background",
}
type Student = {
  id: string
  name: string
  rollNumber: string
  status: Mark
}

type Offering = { id: string; code: string; name: string }
type Batch = { id: string; name: string; count: number }

export function AttendanceClient({
  classId,
  date,
  dateLabel,
  slot,
  offeringId,
  batchId,
  practical,
  needsBatch,
  wholeClass,
  preBatchHistory,
  batchesHref,
  offerings,
  batches,
  students,
}: {
  classId: string
  date: string
  dateLabel: string
  slot: string
  offeringId: string | null
  batchId: string | null
  practical: boolean
  needsBatch: boolean
  wholeClass: boolean
  preBatchHistory: boolean
  batchesHref: string | null
  offerings: Offering[]
  batches: Batch[]
  students: Student[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [marks, setMarks] = useState<Record<string, Mark>>(
    Object.fromEntries(students.map((s) => [s.id, s.status]))
  )
  const [filter, setFilter] = useState<"all" | Status | "unmarked">("all")
  const [focusId, setFocusId] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const moveFocus = useRef(false)

  const subject = offerings.find((o) => o.id === offeringId) ?? null
  const batch = batches.find((b) => b.id === batchId) ?? null
  const batchParam = batchId ?? (wholeClass ? WHOLE_CLASS : null)
  const showBatches = practical && batches.length > 0

  // Only fills the gaps. A blanket "all present" is how a register gets taken
  // without being read; this leaves deliberate marks alone and says how many it
  // is about to touch.
  const markRemaining = (status: Status) =>
    setMarks((m) =>
      Object.fromEntries(students.map((s) => [s.id, m[s.id] ?? status]))
    )

  // Date, slot, subject and batch together identify the session, so changing
  // any of them navigates rather than mutating what is on screen: a half-marked
  // register must not silently become another session's. A batch belongs to one
  // subject, so changing the subject drops it.
  const go = (next: {
    date?: string
    slot?: string
    offering?: string | null
    batch?: string | null
  }) => {
    const d = next.date ?? date
    const s = next.slot ?? slot
    const o = next.offering === undefined ? offeringId : next.offering
    const b =
      next.batch !== undefined
        ? next.batch
        : o === offeringId
          ? batchParam
          : null
    const q = new URLSearchParams({ date: d, slot: s })
    if (o) q.set("offering", o)
    if (b) q.set("batch", b)
    router.push(`/dashboard/class/${classId}/attendance?${q}`)
  }

  const markedCount = students.filter((s) => marks[s.id] != null).length
  const remaining = students.length - markedCount
  const unsavedCount = students.filter(
    (s) => marks[s.id] != null && marks[s.id] !== s.status
  ).length
  const countOf = (v: Status) =>
    students.filter((s) => marks[s.id] === v).length
  const visible = students.filter((s) => {
    if (filter === "all") return true
    if (filter === "unmarked") return marks[s.id] == null
    return marks[s.id] === filter
  })

  const activeId =
    focusId && visible.some((s) => s.id === focusId)
      ? focusId
      : (visible[0]?.id ?? null)

  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    if (activeId) rowRefs.current.get(activeId)?.focus()
  })

  const focusRow = (id: string | undefined) => {
    if (!id || id === activeId) return
    moveFocus.current = true
    setFocusId(id)
  }

  const setMark = (studentId: string, value: Mark) =>
    setMarks((m) => ({ ...m, [studentId]: value }))

  const onRowKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const student = visible[index]
    if (!student) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      focusRow(visible[index + 1]?.id)
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      focusRow(visible[index - 1]?.id)
      return
    }
    if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault()
      setMark(student.id, null)
      return
    }

    const status = KEY_STATUS[e.key]
    if (!status) return
    e.preventDefault()
    setMark(student.id, status)
    focusRow(visible.slice(index + 1).find((s) => marks[s.id] == null)?.id)
  }

  function save() {
    start(async () => {
      const res = await saveAttendanceAction({
        classId,
        sessionDate: date,
        sessionSlot: slot,
        offeringId,
        batchId,
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
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          {subject ? (
            <>
              <span className="identifier">{subject.code}</span> {subject.name}
            </>
          ) : (
            "Class session (no subject)"
          )}
        </h2>
        {batch ? (
          <Badge variant="outline">Batch {batch.name}</Badge>
        ) : wholeClass ? (
          <Badge className="bg-attention text-attention-foreground">
            Whole class, before batches
          </Badge>
        ) : needsBatch ? (
          <span className="text-attention text-xs font-medium">
            No batch selected
          </span>
        ) : null}
        <p className="text-muted-foreground text-sm">
          {dateLabel} · Slot {slot}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">Date</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
            className="h-9 w-44"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">Session</span>
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
        </label>
        {showBatches && (
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs">Batch</span>
            <select
              value={batchParam ?? ""}
              onChange={(e) => go({ batch: e.target.value || null })}
              className="border-input bg-background h-9 rounded border px-2 text-sm"
            >
              <option value="">Select a batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.count} student{b.count === 1 ? "" : "s"}
                </option>
              ))}
              {preBatchHistory && (
                <option value={WHOLE_CLASS}>
                  Whole class (before batches)
                </option>
              )}
            </select>
          </label>
        )}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
            disabled={remaining === 0 || wholeClass}
            onClick={() => {
              if (
                window.confirm(
                  `Mark the remaining ${remaining} student${remaining === 1 ? "" : "s"}${batch ? ` in batch ${batch.name}` : ""} present? Students you have already marked are left alone.`
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
            disabled={pending || unsavedCount === 0}
            onClick={save}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {wholeClass && (
        <p className="text-muted-foreground text-xs">
          This is not a batch. It is the whole-class register from before this
          lab was split, and every mark here stays untagged. You can correct a
          student who was already marked in this session; a student who was not
          cannot be added here, and the save will be refused.
        </p>
      )}

      {practical && batches.length === 0 && (
        <p className="text-muted-foreground text-xs">
          This lab has not been split into batches yet, so the whole class is
          shown.
          {batchesHref && (
            <>
              {" "}
              <Link
                href={batchesHref}
                className="hover:text-foreground underline underline-offset-2"
              >
                Split it on the Batches tab
              </Link>
              .
            </>
          )}
        </p>
      )}

      {needsBatch ? (
        <EmptyState
          icon={FlaskConicalIcon}
          variant="dashed"
          title="Choose a batch to open its register"
          description="This lab is taught one batch at a time, and each batch sits in a different session. Nothing is opened until you say which one you are teaching."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-xs">
              {markedCount} of {students.length} marked
              {unsavedCount > 0 && (
                <span className="text-foreground">
                  {" "}
                  · {unsavedCount} unsaved
                </span>
              )}
              {remaining > 0 && (
                <span className="text-attention">
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
              {batch
                ? "No students in this batch yet."
                : "No students in this class yet."}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No students match that filter.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="pointer-hint text-muted-foreground text-xs">
                Keys: 1 present · 2 absent · 3 late · 4 excused · 0 clears
              </p>
              <div className="border-border overflow-hidden rounded border">
                <ul className="divide-border divide-y">
                  {visible.map((s, i) => {
                    const status = marks[s.id]
                    return (
                      // A register is taken standing up, on a phone, while
                      // looking at the room. On a narrow screen the four
                      // buttons get a row of their own under the name rather
                      // than being squeezed beside it, and each is tall enough
                      // to hit without aiming.
                      <li
                        key={s.id}
                        ref={(el) => {
                          if (el) rowRefs.current.set(s.id, el)
                          else rowRefs.current.delete(s.id)
                        }}
                        tabIndex={s.id === activeId ? 0 : -1}
                        aria-label={`${s.rollNumber} ${s.name}`}
                        onFocus={() => setFocusId(s.id)}
                        onKeyDown={(e) => onRowKeyDown(e, i)}
                        className="focus-visible:outline-ring flex flex-col gap-2 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {s.rollNumber}
                          </Badge>
                          <span className="text-sm">{s.name}</span>
                          {status == null && (
                            <span className="text-attention ml-auto text-xs sm:hidden">
                              Unmarked
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {status == null && (
                            <span className="text-attention hidden text-xs sm:inline">
                              Unmarked
                            </span>
                          )}
                          <div className="grid w-full grid-cols-4 overflow-hidden rounded border sm:flex sm:w-auto">
                            {STATUSES.map((v) => (
                              <button
                                key={v}
                                type="button"
                                tabIndex={-1}
                                aria-pressed={status === v}
                                // Pressing the current value clears it, so a
                                // mark made by mistake can be taken back to
                                // unmarked rather than forced into being one of
                                // the other four.
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
