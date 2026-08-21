"use client"

import { useState } from "react"
import { ChevronRightIcon } from "lucide-react"

import { SubjectBreakdown } from "@/components/subject-breakdown"
import { Badge } from "@/components/ui/badge"
import {
  computeMarks,
  marksState,
  type CourseInfo,
  type MarksInput,
} from "@/lib/sgpi"
import { cn } from "@/lib/utils"

/** An unpublished subject carries no marks at all, so nothing the student may not see reaches the browser. */
export type MarksTableRow =
  | {
      code: string
      name: string
      published: true
      marks: MarksInput
      course: CourseInfo
    }
  | { code: string; name: string; published: false }

type PublishedRow = Extract<MarksTableRow, { published: true }>

const HEAD =
  "text-muted-foreground [&>th]:pb-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:whitespace-nowrap"

const BODY = "[&>td]:py-2 [&>td]:align-top"

const MASKED = ["ISA", "MSE", "ESE", "Total"]

const COLUMN_COUNT = 8

export function MarksTable({ rows }: { rows: MarksTableRow[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

  const toggle = (code: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(code)) next.add(code)
      return next
    })

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className={HEAD}>
            <th className="w-24">Code</th>
            <th>Subject</th>
            <th className="w-20 text-right">ISA</th>
            <th className="w-20 text-right">MSE</th>
            <th className="w-20 text-right">ESE</th>
            <th className="w-24 text-right">Total</th>
            <th className="w-24 text-right">Grade</th>
            <th className="w-8">
              <span className="sr-only">Breakdown</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row) =>
            row.published ? (
              <SubjectRow
                key={row.code}
                row={row}
                expanded={open.has(row.code)}
                onToggle={() => toggle(row.code)}
              />
            ) : (
              <AwaitingRow key={row.code} code={row.code} name={row.name} />
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

function SubjectRow({
  row,
  expanded,
  onToggle,
}: {
  row: PublishedRow
  expanded: boolean
  onToggle: () => void
}) {
  const c = computeMarks(row.marks, row.course)
  const state = marksState(row.marks, row.course)
  const hasMse = row.course.maxMse > 0
  const entered = state !== "empty"
  const open = entered && expanded

  return (
    <>
      <tr
        className={cn(
          BODY,
          entered &&
            "hover:bg-muted/50 focus-visible:outline-ring cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2",
          open && "bg-muted/25"
        )}
        {...(entered
          ? {
              role: "button" as const,
              tabIndex: 0,
              "aria-expanded": expanded,
              "aria-label": `${row.code} breakdown`,
              onClick: onToggle,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key !== "Enter" && e.key !== " ") return
                e.preventDefault()
                onToggle()
              },
            }
          : {})}
      >
        <td className="identifier whitespace-nowrap">{row.code}</td>
        <td className="max-w-[16rem] pr-3">{row.name}</td>
        <ComponentCell value={row.marks.isa} max={row.course.maxIsa} />
        <ComponentCell
          value={hasMse ? c.finalMse : null}
          max={row.course.maxMse}
        />
        <ComponentCell value={row.marks.ese} max={row.course.maxEse} />
        <td className="text-right">
          {state === "empty" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <>
              <span className="identifier">
                {c.total}
                <span className="text-muted-foreground">
                  /{row.course.maxTotal}
                </span>
              </span>
              {state === "partial" && (
                <span className="text-muted-foreground block text-xs">
                  provisional
                </span>
              )}
            </>
          )}
        </td>
        <td className="text-right">
          {state === "graded" ? (
            c.gradePoint === "Fail" ? (
              <Badge variant="destructive">Fail</Badge>
            ) : (
              <Badge variant="outline">{c.gradePoint}</Badge>
            )
          ) : state === "partial" ? (
            <span className="text-muted-foreground text-xs">In progress</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="text-muted-foreground">
          {entered && (
            <ChevronRightIcon
              data-open={open ? "" : undefined}
              className="size-3.5 transition-transform duration-150 data-open:rotate-90"
              aria-hidden
            />
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-muted/25">
          <td colSpan={COLUMN_COUNT} className="py-4">
            <SubjectBreakdown marks={row.marks} course={row.course} />
          </td>
        </tr>
      )}
    </>
  )
}

function AwaitingRow({ code, name }: { code: string; name: string }) {
  return (
    <tr className={BODY}>
      <td className="identifier whitespace-nowrap">{code}</td>
      <td className="max-w-[16rem] pr-3">{name}</td>
      {MASKED.map((column) => (
        <td key={column} className="text-muted-foreground text-right">
          —
        </td>
      ))}
      <td className="text-right">
        <Badge variant="outline" className="text-muted-foreground font-normal">
          Awaiting
        </Badge>
      </td>
      <td>
        <span className="sr-only">No breakdown yet</span>
      </td>
    </tr>
  )
}

function ComponentCell({ value, max }: { value: number | null; max: number }) {
  if (max <= 0) {
    return <td className="text-muted-foreground text-right">—</td>
  }
  return (
    <td className="identifier text-right whitespace-nowrap">
      {value == null ? <span className="text-muted-foreground">—</span> : value}
      <span className="text-muted-foreground">/{max}</span>
    </td>
  )
}
