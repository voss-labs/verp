"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { computeMarks, type MarksInput } from "@/lib/sgpi"
import { invalidReason, markBounds, type Bound } from "@/lib/marks-integrity"
import { SubjectResultCells } from "@/components/subject-result"
import { downloadBase64File } from "@/lib/utils"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { DistributionSummary } from "./grid-summary"
import { LockPanel, LOCK_LABEL, type LockComponent } from "./lock-panel"
import { MarkInput, atEdge, cellKey, coordsOf } from "./mark-input"
import { parseClipboardMatrix, parseMark } from "./paste"
import type { Grid, Offering, Row } from "./types"
import {
  saveMarksAction,
  setMarksLockAction,
  setPublishedAction,
} from "../../actions"

type Field = Bound["field"]

const BLANK: MarksInput = { isa: null, mse1: null, mse2: null, ese: null }

function componentOf(field: Field): LockComponent {
  if (field === "isa") return "isa"
  if (field === "ese") return "ese"
  return "mse"
}

export function MarksGrid({
  classId,
  offering,
  grid,
}: {
  classId: string
  offering: Offering
  grid: Grid
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rows, setRows] = useState<Row[]>(grid.rows)
  const [dirty, setDirty] = useState(false)
  const [invalid, setInvalid] = useState<Record<string, string>>({})
  const cells = useRef(new Map<string, HTMLInputElement>())
  const { course } = grid
  const hasMse = course.maxMse > 0
  const columns = useMemo(() => markBounds(course), [course])
  const saved = useMemo(
    () => new Map(grid.rows.map((r) => [r.studentId, r])),
    [grid.rows]
  )
  const locked = grid.locked
  const isLocked = (c: LockComponent) => locked.some((l) => l.component === c)
  const mayUnlock = (c: LockComponent) =>
    locked.find((l) => l.component === c)?.canUnlock ?? false
  const allLocked =
    isLocked("isa") && isLocked("ese") && (!hasMse || isLocked("mse"))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = true
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const register = useCallback((el: HTMLInputElement | null) => {
    if (!el?.dataset.cell) return
    cells.current.set(el.dataset.cell, el)
  }, [])

  function focusCell(row: number, col: number, dRow: number, dCol: number) {
    let r = row + dRow
    let c = col + dCol
    while (r >= 0 && r < rows.length && c >= 0 && c < columns.length) {
      const el = cells.current.get(cellKey(r, c))
      if (el && !el.disabled) {
        el.focus()
        el.select()
        return true
      }
      r += dRow
      c += dCol
    }
    return false
  }

  function cellError(field: Field, value: number | null) {
    return invalidReason({ ...BLANK, [field]: value }, course)
  }

  function togglePublished(next: boolean) {
    start(async () => {
      const res = await setPublishedAction({
        offeringId: offering.id,
        published: next,
      })
      if (res.error) return void toast.error(res.error)
      toast.success(next ? "Results published" : "Results withdrawn")
      router.refresh()
    })
  }

  function toggleLock(component: LockComponent, next: boolean) {
    start(async () => {
      const res = await setMarksLockAction({
        offeringId: offering.id,
        component,
        locked: next,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(
        next
          ? `${LOCK_LABEL[component]} locked`
          : `${LOCK_LABEL[component]} reopened`
      )
      router.refresh()
    })
  }

  async function handleExport(format: "csv" | "xlsx") {
    const headers = [
      "Roll",
      "Name",
      ...columns.map((c) => c.label),
      "Total",
      "%",
      "Grade",
    ]
    const body = rows.map((r) => {
      const c = computeMarks(r, course)
      return [
        r.rollNumber,
        r.name,
        ...columns.map((col) => r[col.field]),
        c.total,
        c.percentage,
        c.gradePoint == null ? "" : String(c.gradePoint),
      ]
    })
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date())
    const filename = `Marks_${offering.code}_${date}.${format}`
    if (format === "xlsx") {
      const b64 = await exportTableXlsx({
        title: `Marks — ${offering.code}`,
        subtitle: offering.name,
        headers,
        rows: body,
      })
      downloadBase64File(
        b64,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    } else {
      downloadBase64File(
        await exportTableCsv({ headers, rows: body }),
        filename,
        "text/csv"
      )
    }
  }

  function edit(studentId: string, field: Field, value: string) {
    const n = value === "" ? null : Number(value)
    setRows((rs) =>
      rs.map((r) => (r.studentId === studentId ? { ...r, [field]: n } : r))
    )
    setDirty(true)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { row, col } = coordsOf(e.currentTarget)
    const target = rows[row]
    const column = columns[col]
    if (!target || !column) return
    edit(target.studentId, column.field, e.currentTarget.value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const { row, col } = coordsOf(e.currentTarget)
    if (!Number.isInteger(row) || !Number.isInteger(col)) return
    if (e.key === "Enter") {
      e.preventDefault()
      focusCell(row, col, e.shiftKey ? -1 : 1, 0)
      return
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      focusCell(row, col, e.key === "ArrowDown" ? 1 : -1, 0)
      return
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const dir = e.key === "ArrowLeft" ? -1 : 1
      if (!atEdge(e.currentTarget, dir)) return
      if (focusCell(row, col, 0, dir)) e.preventDefault()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const { row, col } = coordsOf(e.currentTarget)
    if (!Number.isInteger(row) || !Number.isInteger(col)) return
    const matrix = parseClipboardMatrix(e.clipboardData.getData("text/plain"))
    if (matrix.length === 0) return
    if (matrix.length === 1 && matrix[0].length === 1) return
    e.preventDefault()

    const next = rows.map((r) => ({ ...r }))
    const touched: string[] = []
    let filled = 0
    let skipped = 0
    matrix.forEach((line, dr) => {
      line.forEach((raw, dc) => {
        const target = next[row + dr]
        const column = columns[col + dc]
        if (!target || !column || isLocked(componentOf(column.field))) {
          skipped++
          return
        }
        const value = parseMark(raw, column.max)
        if (value == null) {
          skipped++
          return
        }
        target[column.field] = value
        touched.push(`${target.studentId}:${column.field}`)
        filled++
      })
    })

    if (filled > 0) {
      setRows(next)
      setDirty(true)
      setInvalid((prev) => {
        const rest = { ...prev }
        for (const key of touched) delete rest[key]
        return rest
      })
    }
    const message = `Filled ${filled} cell${filled === 1 ? "" : "s"}, skipped ${skipped}`
    if (skipped > 0) toast.warning(message)
    else toast.success(message)
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const { row, col } = coordsOf(e.currentTarget)
    const target = rows[row]
    const column = columns[col]
    if (!target || !column) return
    const key = `${target.studentId}:${column.field}`
    const reason = cellError(column.field, target[column.field])
    setInvalid((prev) => {
      const rest = { ...prev }
      if (reason) rest[key] = reason
      else delete rest[key]
      return rest
    })
  }

  function save() {
    const blocked: { roll: string; reason: string }[] = []
    const payload = rows.map((r) => {
      const before = saved.get(r.studentId)
      const out = {
        studentId: r.studentId,
        isa: r.isa,
        mse1: r.mse1,
        mse2: r.mse2,
        ese: r.ese,
      }
      for (const column of columns) {
        const reason = cellError(column.field, r[column.field])
        if (!reason) continue
        out[column.field] = before?.[column.field] ?? null
        blocked.push({ roll: r.rollNumber, reason })
      }
      return out
    })

    start(async () => {
      const res = await saveMarksAction({
        offeringId: offering.id,
        rows: payload,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Marks saved")
      setDirty(false)
      router.refresh()
      if (blocked.length === 1) {
        toast.warning(
          `Roll ${blocked[0].roll}: ${blocked[0].reason} Not saved.`
        )
      } else if (blocked.length > 1) {
        const rolls = [...new Set(blocked.map((b) => b.roll))]
        const named = rolls.slice(0, 5).join(", ")
        const more = rolls.length > 5 ? ` and ${rolls.length - 5} more` : ""
        toast.warning(`Out of range, not saved: ${named}${more}`)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/class/${classId}/marks`)}
          >
            ← Subjects
          </Button>
          <Badge variant="outline" className="font-mono">
            {offering.code}
          </Badge>
          <span className="text-sm font-medium">{offering.name}</span>
          <Badge variant={grid.published ? "outline" : "secondary"}>
            {grid.published ? "Published" : "Not published"}
          </Badge>
          <span className="text-muted-foreground text-xs">
            ISA/{course.maxIsa}
            {hasMse ? ` · MSE/${course.maxMse}` : ""} · ESE/{course.maxEse} ·
            Total/{course.maxTotal}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={rows.length === 0}
          >
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={rows.length === 0}
          >
            Excel
          </Button>
          <Button
            size="sm"
            disabled={pending || allLocked || !dirty}
            onClick={save}
          >
            {pending ? "Saving…" : "Save marks"}
          </Button>
        </div>
      </div>

      {/* Publication is the last step, and reads as one: locking each component
          says the figures are final, publishing says the student may see them. */}
      <div className="border-border flex flex-wrap items-center gap-3 rounded border px-3 py-2">
        <span className="text-muted-foreground text-xs font-medium">
          Results
        </span>
        <Badge variant={grid.published ? "outline" : "secondary"}>
          {grid.published ? "Published" : "Not published"}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {grid.published
            ? "Students can see their grade for this subject."
            : "Students cannot see a grade for this subject yet."}
        </span>
        {grid.canPublish ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={() => togglePublished(!grid.published)}
          >
            {grid.published ? "Withdraw" : "Publish results"}
          </Button>
        ) : (
          <span className="text-muted-foreground ml-auto text-xs">
            The class coordinator publishes results.
          </span>
        )}
      </div>

      <LockPanel
        hasMse={hasMse}
        isLocked={isLocked}
        mayUnlock={mayUnlock}
        pending={pending}
        onToggle={toggleLock}
      />

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No students in this class yet.
        </p>
      ) : (
        <>
          <DistributionSummary rows={rows} columns={columns} course={course} />
          <div className="border-border marks-grid rounded border">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th>Roll</th>
                  <th>Name</th>
                  {columns.map((c) => (
                    <th key={c.field} className="w-20">
                      {c.label}
                    </th>
                  ))}
                  <th className="w-16">Total</th>
                  <th className="w-16">%</th>
                  <th className="w-16">Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.studentId} className="[&>td]:px-3 [&>td]:py-1.5">
                    <td className="identifier">{r.rollNumber}</td>
                    <td className="whitespace-nowrap">{r.name}</td>
                    {columns.map((c, ci) => (
                      <td key={c.field}>
                        <MarkInput
                          cell={cellKey(ri, ci)}
                          label={`${r.rollNumber} ${c.label}`}
                          value={r[c.field]}
                          max={c.max}
                          locked={isLocked(componentOf(c.field))}
                          invalid={invalid[`${r.studentId}:${c.field}`]}
                          register={register}
                          onChange={handleChange}
                          onKeyDown={handleKeyDown}
                          onPaste={handlePaste}
                          onBlur={handleBlur}
                        />
                      </td>
                    ))}
                    {/* The same cells the student will see, so a teacher can
                        tell what a row currently reads as before publishing. */}
                    <SubjectResultCells marks={r} course={course} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
