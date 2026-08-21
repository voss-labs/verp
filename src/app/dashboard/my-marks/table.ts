"use client"

import { toast } from "sonner"

import {
  computeMarks,
  marksState,
  type CgpaResult,
  type CourseInfo,
  type SgpiResult,
} from "@/lib/sgpi"
import { downloadBase64File } from "@/lib/utils"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"

export type Subject = {
  code: string
  name: string
  credits: number
  marks: {
    isa: number | null
    mse1: number | null
    mse2: number | null
    ese: number | null
  }
  course: CourseInfo
}

export type Semester = { semester: number; subjects: Subject[] }

export type AttendanceRow = {
  offeringId: string | null
  code: string
  name: string
  present: number
  total: number
  percent: number | null
}

export type Awaiting = { code: string; name: string; semester: number }

export type Row = { code: string; name: string; subject: Subject | null }

export type Block = {
  semester: number
  rows: Row[]
  sgpi: SgpiResult | undefined
  scheme: CourseInfo | null
}

export const COLUMNS = [
  "Code",
  "Subject",
  "Credits",
  "ISA",
  "MSE 1",
  "MSE 2",
  "ESE",
  "Total",
  "%",
  "Grade",
]

export const MASKED_COLUMNS = COLUMNS.slice(2, 9)

export const COLUMN_COUNT = COLUMNS.length + 1

export function mark(value: number | null, max: number) {
  return value == null ? "—" : `${value}/${max}`
}

export function schemeSegments(scheme: CourseInfo) {
  return [
    { label: "ISA", value: scheme.maxIsa },
    ...(scheme.maxMse > 0 ? [{ label: "MSE", value: scheme.maxMse }] : []),
    { label: "ESE", value: scheme.maxEse },
  ]
}

export function schemeLegend(scheme: CourseInfo) {
  const mse = scheme.maxMse > 0 ? `MSE ${scheme.maxMse} · ` : ""
  return `ISA ${scheme.maxIsa} · ${mse}ESE ${scheme.maxEse} · Total ${scheme.maxTotal}`
}

function uniformScheme(rows: Row[]): CourseInfo | null {
  const courses = rows.flatMap((r) => (r.subject ? [r.subject.course] : []))
  const first = courses[0]
  if (!first) return null
  const uniform = courses.every(
    (c) =>
      c.maxIsa === first.maxIsa &&
      c.maxMse === first.maxMse &&
      c.maxEse === first.maxEse &&
      c.maxTotal === first.maxTotal
  )
  return uniform ? first : null
}

export function buildBlocks(
  semesters: Semester[],
  awaiting: Awaiting[],
  cgpa: CgpaResult
): Block[] {
  const bySemester = new Map<number, Row[]>()
  const push = (semester: number, row: Row) => {
    const list = bySemester.get(semester) ?? []
    list.push(row)
    bySemester.set(semester, list)
  }

  for (const sem of semesters) {
    for (const subject of sem.subjects) {
      push(sem.semester, { code: subject.code, name: subject.name, subject })
    }
  }
  for (const a of awaiting) {
    push(a.semester, { code: a.code, name: a.name, subject: null })
  }

  return [...bySemester.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([semester, rows]) => {
      const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code))
      return {
        semester,
        rows: sorted,
        sgpi: cgpa.perSemester.find((p) => p.semester === semester)?.sgpi,
        scheme: uniformScheme(sorted),
      }
    })
}

function blockRows(block: Block): (string | number | null)[][] {
  return block.rows.map((row) => {
    if (!row.subject) {
      return [
        row.code,
        row.name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Awaiting publication",
      ]
    }
    const s = row.subject
    const c = computeMarks(s.marks, s.course)
    const state = marksState(s.marks, s.course)
    const hasMse = s.course.maxMse > 0
    return [
      s.code,
      s.name,
      s.credits,
      s.marks.isa,
      hasMse ? s.marks.mse1 : "",
      hasMse ? s.marks.mse2 : "",
      s.marks.ese,
      state === "empty" ? "" : c.total,
      state === "graded"
        ? c.percentage
        : state === "partial"
          ? "Provisional"
          : "",
      state === "graded"
        ? String(c.gradePoint)
        : state === "partial"
          ? "In progress"
          : "",
    ]
  })
}

export async function copyBlock(block: Block) {
  const tsv = [COLUMNS, ...blockRows(block)]
    .map((row) => row.map((cell) => cell ?? "").join("\t"))
    .join("\n")
  try {
    await navigator.clipboard.writeText(tsv)
    toast.success(`Semester ${block.semester} table copied`)
  } catch {
    toast.error("Could not copy to the clipboard")
  }
}

export async function exportBlock(block: Block, format: "csv" | "xlsx") {
  const rows = blockRows(block)
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date())
  const filename = `My_marks_Semester_${block.semester}_${date}.${format}`

  try {
    if (format === "xlsx") {
      const b64 = await exportTableXlsx({
        title: `My marks — Semester ${block.semester}`,
        subtitle: block.scheme ? schemeLegend(block.scheme) : undefined,
        headers: COLUMNS,
        rows,
      })
      downloadBase64File(
        b64,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      return
    }
    downloadBase64File(
      await exportTableCsv({ headers: COLUMNS, rows }),
      filename,
      "text/csv"
    )
  } catch {
    toast.error("Could not build the download")
  }
}
