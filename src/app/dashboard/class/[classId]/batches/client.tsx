"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2Icon, FlaskConicalIcon, UsersIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmAction } from "@/components/confirm-action"
import { EmptyState } from "@/components/empty-state"
import {
  createBatchAction,
  assignBatchAction,
  removeFromBatchAction,
} from "../../actions"

type Person = { id: string; rollNumber: string; name: string }
type Batch = { id: string; name: string; students: Person[] }
type Offering = { id: string; code: string; name: string }

export function BatchesClient({
  classId,
  offerings,
  selectedId,
  batches,
  roster,
}: {
  classId: string
  offerings: Offering[]
  selectedId: string | null
  batches: Batch[]
  roster: Person[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState("")
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState<string | null>(batches[0]?.id ?? null)

  if (offerings.length === 0) {
    return (
      <EmptyState
        icon={FlaskConicalIcon}
        variant="dashed"
        title="No practical or project subjects yet"
        description="Add one on the Subjects tab — batches only apply to lab sessions, because a theory lecture is delivered to the whole division at once."
      />
    )
  }

  // A student sits in one batch per subject, so anyone already placed is not
  // offered again: the list left over IS the work still to do.
  const placed = new Set(batches.flatMap((b) => b.students.map((s) => s.id)))
  const unplaced = roster.filter((s) => !placed.has(s.id))
  const activeTarget =
    target && batches.some((b) => b.id === target) ? target : null

  function addBatch() {
    if (!selectedId) return
    start(async () => {
      const res = await createBatchAction({ offeringId: selectedId, name })
      if (res.error) return void toast.error(res.error)
      setName("")
      toast.success("Batch created")
      router.refresh()
    })
  }

  function assign() {
    if (!activeTarget || picked.size === 0) return
    start(async () => {
      const res = await assignBatchAction({
        batchId: activeTarget,
        studentIds: [...picked],
      })
      if (res.error) return void toast.error(res.error)
      setPicked(new Set())
      toast.success("Students assigned")
      router.refresh()
    })
  }

  function remove(batchId: string, studentId: string) {
    return new Promise<void>((resolve) => {
      start(async () => {
        try {
          const res = await removeFromBatchAction({ batchId, studentId })
          if (res.error) return void toast.error(res.error)
          router.refresh()
        } finally {
          resolve()
        }
      })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {offerings.map((o) => (
          <Button
            key={o.id}
            size="sm"
            variant={o.id === selectedId ? "default" : "outline"}
            onClick={() =>
              router.push(
                `/dashboard/class/${classId}/batches?offering=${o.id}`
              )
            }
          >
            <span className="identifier">{o.code}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">New batch</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="B1"
            className="h-9 w-32"
          />
        </label>
        <Button size="sm" disabled={pending || !name.trim()} onClick={addBatch}>
          Add batch
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            Unassigned{" "}
            <span className="text-muted-foreground">({unplaced.length})</span>
          </h2>
          {unplaced.length === 0 ? (
            <EmptyState
              icon={CheckCircle2Icon}
              variant="dashed"
              title="Everyone has a batch"
              description="Every student on this roster is placed for this subject."
            />
          ) : (
            <>
              <div className="border-border max-h-80 overflow-y-auto rounded border">
                {unplaced.map((s) => (
                  <label
                    key={s.id}
                    className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={picked.has(s.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(picked)
                        if (v) next.add(s.id)
                        else next.delete(s.id)
                        setPicked(next)
                      }}
                    />
                    <span className="identifier">{s.rollNumber}</span>
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {picked.size} selected →
                </span>
                {batches.map((b) => (
                  <Button
                    key={b.id}
                    size="sm"
                    variant={activeTarget === b.id ? "default" : "outline"}
                    onClick={() => setTarget(b.id)}
                  >
                    {b.name}
                  </Button>
                ))}
                <Button
                  size="sm"
                  disabled={pending || !activeTarget || picked.size === 0}
                  onClick={assign}
                >
                  Assign
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Batches</h2>
          {batches.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              variant="dashed"
              title="No batches yet"
              description="Create one above to split practicals into lab groups."
            />
          ) : (
            batches.map((b) => (
              <div key={b.id} className="border-border rounded border">
                <div className="bg-muted/50 flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium">{b.name}</span>
                  <Badge variant="outline">{b.students.length}</Badge>
                </div>
                {b.students.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-2 text-xs">
                    Empty
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    {b.students.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between px-3 py-1.5 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span className="identifier">{s.rollNumber}</span>
                          <span>{s.name}</span>
                        </span>
                        <ConfirmAction
                          disabled={pending}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 px-2 text-xs"
                            >
                              Remove
                            </Button>
                          }
                          title={`Remove ${s.name} from ${b.name}?`}
                          description={`${s.rollNumber} goes back to the unassigned list for this subject and can be put in another batch.`}
                          confirmLabel="Remove"
                          onConfirm={() => remove(b.id, s.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
