"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { saveAttendanceAction } from "../../actions"

type Status = "present" | "absent"
type Student = {
  id: string
  name: string
  rollNumber: string
  status: Status
}

export function AttendanceClient({
  classId,
  date,
  slot,
  students,
}: {
  classId: string
  date: string
  slot: string
  students: Student[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [marks, setMarks] = useState<Record<string, Status>>(
    Object.fromEntries(students.map((s) => [s.id, s.status]))
  )

  const setAll = (status: Status) =>
    setMarks(Object.fromEntries(students.map((s) => [s.id, status])))

  const goDate = (d: string) =>
    router.push(`/dashboard/class/${classId}/attendance?date=${d}&slot=${slot}`)

  const presentCount = Object.values(marks).filter(
    (s) => s === "present"
  ).length

  function save() {
    start(async () => {
      const res = await saveAttendanceAction({
        classId,
        sessionDate: date,
        sessionSlot: slot,
        marks: students.map((s) => ({ studentId: s.id, status: marks[s.id] })),
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
            onChange={(e) => e.target.value && goDate(e.target.value)}
            className="h-9 w-44"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll("present")}>
            All present
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAll("absent")}>
            All absent
          </Button>
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        {presentCount} / {students.length} present
      </p>

      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No students in this class yet.
        </p>
      ) : (
        <div className="border-border overflow-hidden rounded border">
          <ul className="divide-border divide-y">
            {students.map((s) => {
              const status = marks[s.id]
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">
                      {s.rollNumber}
                    </Badge>
                    <span className="text-sm">{s.name}</span>
                  </div>
                  <div className="flex overflow-hidden rounded border">
                    {(["present", "absent"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setMarks((m) => ({ ...m, [s.id]: v }))}
                        className={cn(
                          "px-3 py-1 text-xs font-medium capitalize transition-colors",
                          status === v
                            ? v === "present"
                              ? "bg-green-600 text-white"
                              : "bg-destructive text-white"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {v}
                      </button>
                    ))}
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
