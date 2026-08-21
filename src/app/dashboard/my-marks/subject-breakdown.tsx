"use client"

import { SubjectBreakdown } from "@/components/subject-breakdown"

import { COLUMN_COUNT, type Subject } from "./table"

export function SubjectBreakdownRow({ subject }: { subject: Subject }) {
  return (
    <tr className="bg-muted/25">
      <td colSpan={COLUMN_COUNT} className="px-3 py-4">
        <SubjectBreakdown marks={subject.marks} course={subject.course} />
      </td>
    </tr>
  )
}
