"use client"

import { useState } from "react"
import { ChevronRightIcon, CopyIcon, GraduationCapIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BatchChip } from "@/components/batch-chip"
import { EmptyState } from "@/components/empty-state"
import { MarksSplitBar } from "@/components/marks-split-bar"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { SubjectResultCells } from "@/components/subject-result"
import { marksState, type CgpaResult } from "@/lib/sgpi"
import { cn } from "@/lib/utils"

import { SubjectBreakdownRow } from "./subject-breakdown"
import {
  MASKED_COLUMNS,
  buildBlocks,
  copyBlock,
  exportBlock,
  schemeLegend,
  schemeSegments,
  type AttendanceRow,
  type Awaiting,
  type Block,
  type Semester,
  type Subject,
} from "./table"

const HEAD_ROW =
  "text-muted-foreground [&>th]:bg-surface [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:whitespace-nowrap [&>th]:shadow-[inset_0_-1px_0_var(--border)]"

const BODY_ROW = "[&>td]:px-3 [&>td]:py-2 [&>td]:whitespace-nowrap"

export function MyMarksClient({
  cgpa,
  semesters,
  awaiting,
  attendance,
}: {
  cgpa: CgpaResult
  semesters: Semester[]
  attendance: AttendanceRow[]
  awaiting: Awaiting[]
}) {
  const blocks = buildBlocks(semesters, awaiting, cgpa)
  const sessions = attendance.reduce((sum, r) => sum + r.total, 0)
  const attended = attendance.reduce((sum, r) => sum + r.present, 0)
  const overall = sessions > 0 ? Math.round((attended / sessions) * 100) : null

  if (blocks.length === 0 && attendance.length === 0) {
    return (
      <EmptyState
        variant="dashed"
        icon={GraduationCapIcon}
        title="No marks yet"
        description="Your results appear here once your teachers enter them and the class coordinator publishes them."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StatCardRow>
        <StatCard
          label="CGPA"
          value={cgpa.hasFail ? "—" : (cgpa.cgpa?.toFixed(2) ?? "—")}
          detail={
            cgpa.hasFail
              ? "Withheld pending a re-attempt"
              : `Across ${cgpa.totalCredits} credits`
          }
        />
        <StatCard
          label="Credit points"
          value={String(cgpa.totalCreditPoints)}
          detail="Earned so far"
        />
        <StatCard
          label="Semesters"
          value={String(cgpa.completedSemesters)}
          detail="Completed"
        />
        <StatCard
          label="Attendance"
          value={overall == null ? "—" : `${overall}%`}
          tone={overall != null && overall < 75 ? "attention" : "default"}
          detail={
            sessions === 0
              ? "No sessions recorded"
              : `${attended} of ${sessions} sessions`
          }
        />
      </StatCardRow>

      {blocks.map((block) => (
        <SemesterBlock key={block.semester} block={block} />
      ))}

      <AttendanceTable rows={attendance} />
    </div>
  )
}

function SemesterBlock({ block }: { block: Block }) {
  const failed = block.sgpi?.hasFail === true
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  function toggle(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(code)) next.add(code)
      return next
    })
  }

  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Semester {block.semester}</h2>
          <Badge variant={failed ? "destructive" : "outline"}>
            {failed
              ? "SGPI withheld"
              : `SGPI ${block.sgpi?.sgpi?.toFixed(2) ?? "—"}`}
          </Badge>
        </div>
        {block.scheme && (
          <div className="flex items-center gap-2">
            <MarksSplitBar
              compact
              className="w-20"
              total={block.scheme.maxTotal}
              segments={schemeSegments(block.scheme)}
            />
            <span className="identifier text-muted-foreground">
              {schemeLegend(block.scheme)}
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copyBlock(block)}>
            <CopyIcon className="mr-1.5 size-3.5" />
            Copy table
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportBlock(block, "csv")}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportBlock(block, "xlsx")}
          >
            Excel
          </Button>
        </div>
      </div>

      <div className="max-h-[60svh] overflow-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className={HEAD_ROW}>
              <th className="w-24">Code</th>
              <th>Subject</th>
              <th className="w-16">Credits</th>
              <th className="w-20">ISA</th>
              <th className="w-20">MSE 1</th>
              <th className="w-20">MSE 2</th>
              <th className="w-20">ESE</th>
              <th className="w-24">Total</th>
              <th className="w-16">%</th>
              <th className="w-32">Grade</th>
              <th className="w-8">
                <span className="sr-only">Breakdown</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {block.rows.map((row) =>
              row.subject ? (
                <SubjectRow
                  key={row.code}
                  subject={row.subject}
                  expanded={expanded.has(row.code)}
                  onToggle={() => toggle(row.code)}
                />
              ) : (
                <AwaitingRow key={row.code} code={row.code} name={row.name} />
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SubjectRow({
  subject,
  expanded,
  onToggle,
}: {
  subject: Subject
  expanded: boolean
  onToggle: () => void
}) {
  const hasMse = subject.course.maxMse > 0
  const entered = marksState(subject.marks, subject.course) !== "empty"
  const open = entered && expanded

  return (
    <>
      <tr
        className={cn(
          BODY_ROW,
          entered &&
            "hover:bg-muted/50 focus-visible:outline-ring cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2",
          open && "bg-muted/25"
        )}
        {...(entered
          ? {
              role: "button" as const,
              tabIndex: 0,
              "aria-expanded": expanded,
              "aria-label": `${subject.code} breakdown`,
              onClick: onToggle,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key !== "Enter" && e.key !== " ") return
                e.preventDefault()
                onToggle()
              },
            }
          : {})}
      >
        <td className="identifier">{subject.code}</td>
        <td className="max-w-[18rem] truncate whitespace-normal">
          {subject.name}
        </td>
        <td className="tabular-nums">{subject.credits}</td>
        <ComponentCell value={subject.marks.isa} max={subject.course.maxIsa} />
        <ComponentCell
          value={hasMse ? subject.marks.mse1 : null}
          max={subject.course.maxMse}
        />
        <ComponentCell
          value={hasMse ? subject.marks.mse2 : null}
          max={subject.course.maxMse}
        />
        <ComponentCell value={subject.marks.ese} max={subject.course.maxEse} />
        <SubjectResultCells marks={subject.marks} course={subject.course} />
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
      {open && <SubjectBreakdownRow subject={subject} />}
    </>
  )
}

function AwaitingRow({ code, name }: { code: string; name: string }) {
  return (
    <tr className={BODY_ROW}>
      <td className="identifier">{code}</td>
      <td className="max-w-[18rem] truncate whitespace-normal">{name}</td>
      {MASKED_COLUMNS.map((column) => (
        <td key={column} className="text-muted-foreground">
          —
        </td>
      ))}
      <td>
        <Badge variant="outline" className="text-muted-foreground font-normal">
          Awaiting publication
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
    return <td className="text-muted-foreground">—</td>
  }
  return (
    <td className="identifier">
      {value == null ? <span className="text-muted-foreground">—</span> : value}
      <span className="text-muted-foreground">/{max}</span>
    </td>
  )
}

function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  if (rows.length === 0) return null

  return (
    <section className="bg-card overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Attendance</h2>
        <p className="text-muted-foreground text-xs">
          VIT requires 75% in each subject. Late counts as present.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className={HEAD_ROW}>
              <th className="w-24">Code</th>
              <th>Subject</th>
              <th className="w-28">Sessions</th>
              <th className="w-16">%</th>
              <th className="w-24">Standing</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((r) => {
              const short = r.percent != null && r.percent < 75
              return (
                <tr key={r.offeringId ?? "class"} className={BODY_ROW}>
                  <td className="identifier">{r.code}</td>
                  <td className="max-w-[18rem] truncate whitespace-normal">
                    {r.name}
                    {r.batch && <BatchChip name={r.batch} className="ml-1.5" />}
                  </td>
                  <td className="identifier">
                    {r.present}
                    <span className="text-muted-foreground">/{r.total}</span>
                  </td>
                  <td
                    className={cn(
                      "font-medium tabular-nums",
                      short && "text-attention"
                    )}
                  >
                    {r.percent == null ? "—" : `${r.percent}%`}
                  </td>
                  <td>
                    {short ? (
                      <Badge variant="outline" className="text-attention">
                        Short
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Meets 75%
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
