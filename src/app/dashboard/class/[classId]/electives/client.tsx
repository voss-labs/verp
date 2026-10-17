"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  BookOpenIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmAction } from "@/components/confirm-action"
import { EmptyState } from "@/components/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  enrollElectiveAction,
  readElectiveListAction,
  removeFromElectiveAction,
  setElectiveAction,
} from "../../actions"

type Person = { id: string; rollNumber: string; name: string }
type Offering = {
  id: string
  code: string
  name: string
  isElective: boolean
  /** A lab, which can be split into batches. */
  lab: boolean
}
/** A sheet read for the selected elective, not yet added. */
type ImportedList = {
  fileName: string
  sheetNames: string[]
  activeSheet: string
  add: Person[]
  already: Person[]
  notInClass: string[]
}

export function ElectivesClient({
  classId,
  classLabel,
  offerings,
  selectedId,
  roster,
  members,
  withMarks,
  batched,
  frozen,
}: {
  classId: string
  classLabel: string
  offerings: Offering[]
  selectedId: string | null
  roster: Person[]
  /** Who is taking the selected subject, when it is an elective. */
  members: string[]
  /** Who already has a mark recorded in the selected subject. */
  withMarks: string[]
  /** Who holds a place in the selected subject's lab batches. */
  batched: string[]
  /** Why the selected subject's roster cannot change right now, or null. */
  frozen: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [list, setList] = useState<ImportedList | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Kept so switching to another tab of the same workbook reads it again.
  const listFile = useRef<File | null>(null)

  if (offerings.length === 0) {
    return (
      <EmptyState
        icon={BookOpenIcon}
        variant="dashed"
        title="No subjects on this class yet"
        description="Add them on the Subjects tab first. An elective is one of the class's subjects, taught to the students who chose it."
      />
    )
  }

  const selected = offerings.find((o) => o.id === selectedId) ?? null
  const taking = new Set(members)
  const marked = new Set(withMarks)
  // Both lists in roll order, so a student is found in the same place in each.
  const onIt = roster.filter((s) => taking.has(s.id))
  const offIt = roster.filter((s) => !taking.has(s.id))
  const locked = frozen !== null
  const inBatch = new Set(batched)
  // Becoming an elective takes everybody not put on it out of its lab batches.
  const leaving = batched.filter((id) => !marked.has(id)).length
  const batchNote =
    leaving === 0
      ? null
      : leaving === 1
        ? "Its lab batches keep only them, so 1 student leaves their batch for now and gets it back when put on it."
        : `Its lab batches keep only them, so ${leaving} students leave their batches for now and get them back when put on it.`

  // Resolves once the action settles, so a confirm dialog stays open and busy
  // until the change has actually landed.
  function run(action: () => Promise<{ error: string | null }>, done: string) {
    return new Promise<void>((resolve) => {
      start(async () => {
        try {
          const res = await action()
          if (res.error) return void toast.error(res.error)
          setPicked(new Set())
          toast.success(done)
          router.refresh()
        } finally {
          resolve()
        }
      })
    })
  }

  function setElective(elective: boolean) {
    if (!selected) return
    return run(
      () => setElectiveAction({ offeringId: selected.id, elective }),
      elective
        ? `${selected.code} is now an elective`
        : `${selected.code} is taught to the whole class`
    )
  }

  function add() {
    if (!selected || picked.size === 0) return
    const studentIds = [...picked]
    void run(
      () => enrollElectiveAction({ offeringId: selected.id, studentIds }),
      `Added to ${selected.code}`
    )
  }

  function remove(studentId: string) {
    if (!selected) return
    return run(
      () => removeFromElectiveAction({ offeringId: selected.id, studentId }),
      "Taken off the elective"
    )
  }

  // Reads only. Nothing changes until the coordinator adds the students the
  // sheet names, through the same action as picking them by hand.
  function readList(file: File, sheet?: string) {
    if (!selected) return
    // A server action takes 1 MB; a list of roll numbers is a few kilobytes.
    if (file.size > 1_000_000) {
      toast.error(
        "That file is over 1 MB. Upload just the list of roll numbers."
      )
      return
    }
    listFile.current = file
    const form = new FormData()
    form.append("offeringId", selected.id)
    form.append("file", file)
    if (sheet) form.append("sheet", sheet)
    start(async () => {
      const res = await readElectiveListAction(form)
      if (res.error || !res.list) {
        toast.error(res.error ?? "Could not read that file")
        return
      }
      setList({ fileName: file.name, ...res.list })
    })
  }

  function addListed() {
    if (!selected || !list || list.add.length === 0) return
    const studentIds = list.add.map((s) => s.id)
    void run(async () => {
      const res = await enrollElectiveAction({
        offeringId: selected.id,
        studentIds,
      })
      if (!res.error) setList(null)
      return res
    }, `Added ${studentIds.length} to ${selected.code}`)
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
                `/dashboard/class/${classId}/electives?offering=${o.id}`
              )
            }
          >
            <span className="identifier">{o.code}</span>
            {o.isElective && " · Elective"}
          </Button>
        ))}
      </div>

      {selected && (
        <div className="border-border flex flex-wrap items-center gap-3 rounded border px-3 py-2">
          <Badge variant="outline" className="identifier">
            {selected.code}
          </Badge>
          <span className="text-sm font-medium">{selected.name}</span>
          <Badge variant={selected.isElective ? "default" : "secondary"}>
            {selected.isElective
              ? `Elective · ${onIt.length} of ${roster.length}`
              : "Whole class"}
          </Badge>
          <div className="ml-auto">
            {selected.isElective ? (
              <ConfirmAction
                label="Teach it to the whole class"
                variant="outline"
                size="sm"
                destructive={false}
                disabled={pending || locked}
                title={`Teach ${selected.code} to the whole class?`}
                description={`All ${roster.length} students in ${classLabel} go back on its marks grid and register, and locking waits for a mark from each of them. The list of who takes it is cleared.${selected.lab ? " Anyone taken out of its lab batches gets their place back." : ""}`}
                confirmLabel="Whole class"
                onConfirm={() => setElective(false)}
              />
            ) : (
              <ConfirmAction
                label="Make it an elective"
                size="sm"
                destructive={false}
                disabled={pending || locked}
                title={`Make ${selected.code} an elective?`}
                description={[
                  "Its marks grid and register will list only the students you put on it.",
                  marked.size > 0 &&
                    `The ${marked.size} who already have marks in it are put on it now.`,
                  batchNote,
                ]
                  .filter(Boolean)
                  .join(" ")}
                confirmLabel="Make elective"
                onConfirm={() => setElective(true)}
              />
            )}
          </div>
        </div>
      )}

      {frozen && <p className="text-muted-foreground text-xs">{frozen}</p>}

      {selected && !selected.isElective && (
        <EmptyState
          icon={UsersIcon}
          variant="dashed"
          title={`${selected.code} is taught to the whole class`}
          description="Every student in the class is on its marks grid and register. If only some of them take it, make it an elective and choose who."
        />
      )}

      {selected?.isElective && list && (
        <div className="border-border flex flex-col gap-3 rounded border p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileSpreadsheetIcon className="text-muted-foreground size-4" />
            <span className="font-medium">{list.fileName}</span>
            {list.sheetNames.length > 1 && (
              <Select
                value={list.activeSheet}
                onValueChange={(sheet) => {
                  if (sheet && listFile.current)
                    readList(listFile.current, sheet)
                }}
                disabled={pending}
              >
                <SelectTrigger size="sm" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {list.sheetNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {list.add.length + list.already.length + list.notInClass.length ===
          0 ? (
            <p className="text-muted-foreground text-sm">
              No roll numbers on this sheet.
            </p>
          ) : (
            <p className="text-sm">
              {list.add.length} to add · {list.already.length} already taking it
              {list.notInClass.length > 0 &&
                ` · ${list.notInClass.length} not in this class`}
            </p>
          )}
          {list.notInClass.length > 0 && (
            <p className="text-destructive text-xs">
              Not in this class, so left out: {list.notInClass.join(", ")}
            </p>
          )}
          {list.add.length > 0 && (
            <div className="border-border max-h-48 overflow-y-auto rounded border">
              {list.add.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm"
                >
                  <span className="identifier">{s.rollNumber}</span>
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={pending || locked || list.add.length === 0}
              onClick={addListed}
            >
              Add {list.add.length} to {selected.code}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setList(null)}
            >
              Cancel
            </Button>
            <span className="text-muted-foreground text-xs">
              Nobody already on it is taken off.
            </span>
          </div>
        </div>
      )}

      {selected?.isElective && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                Not taking it{" "}
                <span className="text-muted-foreground">({offIt.length})</span>
              </h2>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || locked}
                onClick={() => fileInput.current?.click()}
              >
                <UploadIcon className="mr-1.5 size-3.5" />
                Import list
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.csv"
                aria-label={`List of students taking ${selected.code}`}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  // Cleared, so choosing the same file again still reads it.
                  e.target.value = ""
                  if (file) readList(file)
                }}
              />
            </div>
            {offIt.length === 0 ? (
              <EmptyState
                icon={CheckCircle2Icon}
                variant="dashed"
                title="Everybody takes it"
                description="Every student in the class is on this elective."
              />
            ) : (
              <>
                <div className="border-border max-h-80 overflow-y-auto rounded border">
                  {offIt.map((s) => (
                    <label
                      key={s.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={picked.has(s.id)}
                        disabled={locked}
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
                  <Button
                    size="sm"
                    disabled={pending || locked || picked.size === 0}
                    onClick={add}
                  >
                    Add to {selected.code}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">
              Taking it{" "}
              <span className="text-muted-foreground">({onIt.length})</span>
            </h2>
            {onIt.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                variant="dashed"
                title="Nobody yet"
                description="Tick the students who chose this elective, or import a list of their roll numbers. Its marks grid and register list only them."
              />
            ) : (
              <div className="border-border max-h-80 overflow-y-auto rounded border">
                {onIt.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-3 py-1.5 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="identifier">{s.rollNumber}</span>
                      <span>{s.name}</span>
                    </span>
                    {marked.has(s.id) ? (
                      <span className="text-muted-foreground text-xs">
                        Has marks
                      </span>
                    ) : (
                      <ConfirmAction
                        disabled={pending || locked}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-6 px-2 text-xs"
                          >
                            Remove
                          </Button>
                        }
                        title={`Take ${s.name} off ${selected.code}?`}
                        description={
                          inBatch.has(s.id)
                            ? `${s.rollNumber} leaves its marks grid, register and lab batch, and can be put back at any time, into the same batch.`
                            : `${s.rollNumber} leaves its marks grid and register, and can be put back at any time.`
                        }
                        confirmLabel="Remove"
                        onConfirm={() => remove(s.id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
