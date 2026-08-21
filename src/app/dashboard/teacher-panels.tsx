import Link from "next/link"
import type { ReactNode } from "react"
import {
  BookOpenIcon,
  CircleCheckIcon,
  ClockIcon,
  TriangleAlertIcon,
  UserRoundCheckIcon,
  type LucideIcon,
} from "lucide-react"

import { AttentionGroup } from "@/components/attention-card"
import { EmptyState } from "@/components/empty-state"
import { MarksSplitBar } from "@/components/marks-split-bar"
import { Badge } from "@/components/ui/badge"
import {
  buttonVariants,
  type ButtonVariants,
} from "@/components/ui/button-variants"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AttentionSummary, Urgency } from "@/lib/attention"
import type { Component } from "@/lib/marks-integrity"
import type { OfferingCompletion } from "@/db/queries/overview"
import { EmptyHint } from "./overview-cards"

export type MySubject = OfferingCompletion & { classKey: string }

export type QueuedEnrolment = {
  requestId: string
  classId: string
  classKey: string
  rollNumber: string
  name: string
}

export type TodayClass = {
  classId: string
  classKey: string
  label: string
  coordinator: boolean
  marked: number
  roster: number
  subjects: MySubject[]
}

const COMPONENT_LABEL: Record<Component, string> = {
  isa: "ISA",
  mse: "MSE",
  ese: "ESE",
}

export const enteredOf = (o: OfferingCompletion) =>
  o.components.reduce((n, k) => n + k.entered, 0)

export const capacityOf = (o: OfferingCompletion) =>
  o.roster * o.components.length

const marksHref = (o: MySubject) =>
  `/dashboard/class/${o.classId}/marks?offering=${o.offeringId}`

export function ToneChip({
  tone,
  icon: Icon,
  label,
}: {
  tone: "success" | "attention"
  icon: LucideIcon
  label: string
}) {
  return (
    <Badge
      variant="secondary"
      className={
        tone === "success"
          ? "bg-success/10 text-success"
          : "bg-attention/10 text-attention"
      }
    >
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  )
}

export function Cta({
  href,
  label,
  variant = "outline",
}: {
  href: string
  label: string
  variant?: ButtonVariants["variant"]
}) {
  return (
    <Link href={href} className={buttonVariants({ variant, size: "sm" })}>
      {label}
    </Link>
  )
}

function QueueRow({
  head,
  action,
  children,
}: {
  head: ReactNode
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="ring-foreground/10 flex flex-col gap-2 rounded-lg p-3 ring-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{head}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function AttendanceRow({
  entry,
  canAttendance,
}: {
  entry: TodayClass
  canAttendance: boolean
}) {
  const taken = entry.marked > 0
  return (
    <QueueRow
      head={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Take attendance</p>
            <ToneChip
              tone={taken ? "success" : "attention"}
              icon={taken ? CircleCheckIcon : ClockIcon}
              label={taken ? "Taken" : "Not taken"}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            <span className="identifier">
              {entry.marked}/{entry.roster}
            </span>{" "}
            marked today
          </p>
        </>
      }
      action={
        canAttendance ? (
          <Cta
            href={`/dashboard/class/${entry.classId}/attendance`}
            label="Take attendance"
            variant={taken ? "outline" : "default"}
          />
        ) : undefined
      }
    >
      <Progress
        value={entry.roster > 0 ? (entry.marked / entry.roster) * 100 : 0}
      />
    </QueueRow>
  )
}

function MarksRow({
  subject,
  canMarks,
}: {
  subject: MySubject
  canMarks: boolean
}) {
  return (
    <QueueRow
      head={
        <>
          <p className="truncate text-sm font-medium">
            <span className="identifier">{subject.courseCode}</span>{" "}
            {subject.courseName}
          </p>
          <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {subject.components.map((k) => (
              <span key={k.component}>
                {COMPONENT_LABEL[k.component]}{" "}
                <span className="identifier">
                  {k.entered}/{subject.roster}
                </span>
              </span>
            ))}
          </p>
        </>
      }
      action={
        canMarks ? (
          <Cta href={marksHref(subject)} label="Enter marks" />
        ) : undefined
      }
    >
      <MarksSplitBar
        compact
        total={capacityOf(subject)}
        segments={subject.components.map((k) => ({
          label: COMPONENT_LABEL[k.component],
          value: k.entered,
        }))}
      />
    </QueueRow>
  )
}

export function TodayQueue({
  classes,
  canAttendance,
  canMarks,
}: {
  classes: TodayClass[]
  canAttendance: boolean
  canMarks: boolean
}) {
  return (
    <div className="flex flex-col gap-5">
      {classes.map((entry) => (
        <div key={entry.classId} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <h4 className="min-w-0 truncate text-sm font-semibold">
              {entry.label}
            </h4>
            <Badge variant="outline" className="identifier">
              {entry.classKey}
            </Badge>
            {entry.coordinator && (
              <Badge variant="secondary">Coordinator</Badge>
            )}
          </div>

          <AttendanceRow entry={entry} canAttendance={canAttendance} />

          {entry.subjects.length === 0 ? (
            <EmptyHint>No subjects allocated to you on this class.</EmptyHint>
          ) : (
            entry.subjects.map((subject) => (
              <MarksRow
                key={subject.offeringId}
                subject={subject}
                canMarks={canMarks}
              />
            ))
          )}
        </div>
      ))}
    </div>
  )
}

function SubjectsTable({
  subjects,
  canMarks,
  showClass = false,
  showTeacher = false,
  empty,
}: {
  subjects: MySubject[]
  canMarks: boolean
  showClass?: boolean
  showTeacher?: boolean
  empty: ReactNode
}) {
  if (subjects.length === 0) return <>{empty}</>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Subject</TableHead>
          {showClass && <TableHead>Class</TableHead>}
          {showTeacher && <TableHead>Teacher</TableHead>}
          <TableHead className="text-right">Entered</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subjects.map((o) => (
          <TableRow key={o.offeringId}>
            <TableCell>
              {canMarks ? (
                <Link
                  href={marksHref(o)}
                  className="identifier hover:underline"
                >
                  {o.courseCode}
                </Link>
              ) : (
                <span className="identifier">{o.courseCode}</span>
              )}
            </TableCell>
            <TableCell>
              <span className="block max-w-[14rem] truncate">
                {o.courseName}
              </span>
            </TableCell>
            {showClass && (
              <TableCell>
                <Badge variant="outline" className="identifier">
                  {o.classKey}
                </Badge>
              </TableCell>
            )}
            {showTeacher && (
              <TableCell>
                {o.facultyName ? (
                  <span className="block max-w-[10rem] truncate">
                    {o.facultyName}
                  </span>
                ) : (
                  <ToneChip
                    tone="attention"
                    icon={TriangleAlertIcon}
                    label="Unallocated"
                  />
                )}
              </TableCell>
            )}
            <TableCell className="identifier text-right">
              {enteredOf(o)}/{capacityOf(o)}
            </TableCell>
            <TableCell>
              {o.publishedAt ? (
                <ToneChip
                  tone="success"
                  icon={CircleCheckIcon}
                  label="Published"
                />
              ) : (
                <Badge variant="outline">Draft</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function MySubjectsTable({
  subjects,
  canMarks,
}: {
  subjects: MySubject[]
  canMarks: boolean
}) {
  return (
    <SubjectsTable
      subjects={subjects}
      canMarks={canMarks}
      showClass
      empty={
        <EmptyState
          icon={BookOpenIcon}
          title="No subjects allocated to you"
          description="A coordinator allocates subjects to teachers on the class."
          variant="dashed"
          action={<Cta href="/dashboard/class" label="My classes" />}
        />
      }
    />
  )
}

export function ClassSubjectsTable({
  subjects,
  canMarks,
  showClass,
  subjectsHref,
}: {
  subjects: MySubject[]
  canMarks: boolean
  showClass: boolean
  subjectsHref: string
}) {
  return (
    <SubjectsTable
      subjects={subjects}
      canMarks={canMarks}
      showClass={showClass}
      showTeacher
      empty={
        <EmptyState
          icon={BookOpenIcon}
          title="No subjects offered yet"
          description="A subject has to be offered on the class before anybody can be allocated to it."
          variant="dashed"
          action={<Cta href={subjectsHref} label="Subjects" />}
        />
      }
    />
  )
}

export function EnrolmentQueue({
  requests,
  remaining,
  showClass,
  canApprove,
}: {
  requests: QueuedEnrolment[]
  remaining: number
  showClass: boolean
  canApprove: boolean
}) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={UserRoundCheckIcon}
        title="Nobody is waiting"
        description="Students who claim a roll number in your class arrive here."
        variant="dashed"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {requests.map((r) => (
        <QueueRow
          key={r.requestId}
          head={
            <>
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="identifier">{r.rollNumber}</span>
                {showClass && (
                  <Badge variant="outline" className="identifier">
                    {r.classKey}
                  </Badge>
                )}
              </p>
            </>
          }
          action={
            canApprove ? (
              <Cta
                href={`/dashboard/class/${r.classId}`}
                label="Approve"
                variant="default"
              />
            ) : undefined
          }
        />
      ))}
      {remaining > 0 && (
        <EmptyHint>
          {remaining} more {remaining === 1 ? "request" : "requests"} waiting.
        </EmptyHint>
      )}
    </div>
  )
}

const URGENCIES: Urgency[] = ["blocking", "overdue", "open"]

const URGENCY_HEADING: Record<Urgency, string> = {
  blocking: "Blocking",
  overdue: "Overdue",
  open: "Open",
}

export function AttentionFeed({ groups }: { groups: AttentionSummary[] }) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CircleCheckIcon}
        title="All clear"
        description="Nothing needs your attention."
        variant="dashed"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {URGENCIES.map((urgency) => {
        const items = groups.filter((g) => g.urgency === urgency)
        if (items.length === 0) return null
        return (
          <AttentionGroup
            key={urgency}
            heading={URGENCY_HEADING[urgency]}
            items={items.map((g) => ({
              severity: g.urgency,
              title: g.title,
              description: g.detail,
              scopes: g.scopes,
              href: g.href,
            }))}
          />
        )
      })}
    </div>
  )
}
