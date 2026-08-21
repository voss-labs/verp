"use client"

import { MarksSplitBar } from "@/components/marks-split-bar"
import {
  DrawerSection,
  RecordDrawer,
  type DrawerFact,
} from "@/components/record-drawer"
import { computeMarks, marksState } from "@/lib/sgpi"

import { mark, type Subject } from "./table"

export type OpenSubject = { subject: Subject; semester: number }

export function SubjectDrawer({
  open,
  onClose,
}: {
  open: OpenSubject | null
  onClose: () => void
}) {
  const subject = open?.subject
  const c = subject ? computeMarks(subject.marks, subject.course) : null
  const state = subject ? marksState(subject.marks, subject.course) : "empty"
  const hasMse = subject != null && subject.course.maxMse > 0

  const facts: DrawerFact[] =
    subject && c
      ? [
          {
            label: "ISA",
            value: mark(subject.marks.isa, subject.course.maxIsa),
            mono: true,
          },
          ...(hasMse
            ? [
                {
                  label: "MSE 1",
                  value: mark(subject.marks.mse1, subject.course.maxMse),
                  mono: true,
                },
                {
                  label: "MSE 2",
                  value: mark(subject.marks.mse2, subject.course.maxMse),
                  mono: true,
                },
                {
                  label: "MSE counted",
                  value: mark(c.finalMse, subject.course.maxMse),
                  mono: true,
                },
              ]
            : []),
          {
            label: "ESE",
            value: mark(subject.marks.ese, subject.course.maxEse),
            mono: true,
          },
          {
            label: "Total",
            value: `${c.total}/${subject.course.maxTotal}`,
            mono: true,
          },
          {
            label: "Percentage",
            value: c.percentage == null ? "—" : `${c.percentage}%`,
            mono: true,
          },
          {
            label: "Grade point",
            value: c.gradePoint == null ? "—" : String(c.gradePoint),
            mono: true,
          },
        ]
      : []

  return (
    <RecordDrawer
      open={open !== null}
      onClose={onClose}
      title={subject?.name ?? ""}
      subtitle={
        open
          ? `Semester ${open.semester} · ${subject?.credits} credits`
          : undefined
      }
      badges={
        subject
          ? [
              { label: subject.code },
              ...(c?.gradePoint === "Fail"
                ? [{ label: "Fail", tone: "critical" as const }]
                : state === "partial"
                  ? [{ label: "In progress", tone: "warn" as const }]
                  : []),
            ]
          : undefined
      }
      facts={facts}
    >
      {subject && c && (
        <DrawerSection title="Where the total comes from">
          <MarksSplitBar
            total={subject.course.maxTotal}
            segments={[
              { label: "ISA", value: subject.marks.isa ?? 0 },
              ...(hasMse ? [{ label: "MSE", value: c.finalMse ?? 0 }] : []),
              { label: "ESE", value: subject.marks.ese ?? 0 },
            ]}
          />
          {c.percentage == null && (
            <p className="text-muted-foreground text-xs">
              Not every component is in yet, so no grade is calculated. This is
              what your teachers have entered so far.
            </p>
          )}
        </DrawerSection>
      )}
    </RecordDrawer>
  )
}
