"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
      <p className="text-muted-foreground text-sm">
        No practical or project subjects in this class yet. Batches only apply
        to lab sessions — a theory lecture is delivered to the whole division at
        once.
      </p>
    )
  }

  // A student sits in one batch per subject, so anyone already placed is not
  // offered again: the list left over IS the work still to do.
  const placed = new Set(batches.flatMap((b) => b.students.map((s) => s.id)))
  const unplaced = roster.filter((s) => !placed.has(s.id))

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
    if (!target || picked.size === 0) return
    start(async () => {
      const res = await assignBatchAction({
        batchId: target,
        studentIds: [...picked],
      })
      if (res.error) return void toast.error(res.error)
      setPicked(new Set())
      toast.success("Students assigned")
      router.refresh()
    })
  }

  function remove(batchId: string, studentId: string) {
    start(async () => {
      const res = await removeFromBatchAction({ batchId, studentId })
      if (res.error) return void toast.error(res.error)
      router.refresh()
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
            <span className="font-mono text-xs">{o.code}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">New batch</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="B1"
            className="h-9 w-32"
          />
        </div>
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
            <p className="text-muted-foreground text-sm">
              Everyone has a batch for this subject.
            </p>
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
                    <span className="font-mono text-xs">{s.rollNumber}</span>
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
                    variant={target === b.id ? "default" : "outline"}
                    onClick={() => setTarget(b.id)}
                  >
                    {b.name}
                  </Button>
                ))}
                <Button
                  size="sm"
                  disabled={pending || !target || picked.size === 0}
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
            <p className="text-muted-foreground text-sm">
              No batches yet. Add one above.
            </p>
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
                          <span className="font-mono text-xs">
                            {s.rollNumber}
                          </span>
                          <span>{s.name}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          disabled={pending}
                          onClick={() => remove(b.id, s.id)}
                        >
                          Remove
                        </Button>
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
