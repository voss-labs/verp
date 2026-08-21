import Link from "next/link"
import {
  Building2Icon,
  CalendarCheckIcon,
  ChartLineIcon,
  CircleCheckIcon,
  HistoryIcon,
  SquarePenIcon,
  UploadIcon,
} from "lucide-react"

import { AttentionCard } from "@/components/attention-card"
import { CompareBars, TrendLine } from "@/components/dash-chart"
import { DashGrid, DashPanel } from "@/components/dash-panel"
import { DeniedToast } from "@/components/denied-toast"
import { EmptyState } from "@/components/empty-state"
import { MarksSplitBar } from "@/components/marks-split-bar"
import { PageHeader } from "@/components/page-header"
import { StatCard, StatCardRow } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button-variants"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buildAttention, groupAttention } from "@/lib/attention"
import { can } from "@/lib/rbac"
import type { SessionUser } from "@/lib/session"
import { cn } from "@/lib/utils"
import type { ImportKind, ImportStatus } from "@/db/schema/import-batches"
import { listDepartments } from "@/db/queries/departments"
import {
  attendanceTrendByScope,
  getDeptHealth,
  marksCompletionByDept,
  pendingEnrolmentsForDepts,
  recentAuditEntries,
  recentImportBatchesForScope,
  registersTodayByDept,
  type AuditEntry,
} from "@/db/queries/overview"

const STAMP = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
})

const DAY = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata",
})

const KIND_LABEL: Record<ImportKind, string> = {
  roster: "Roster",
  faculty: "Faculty",
  courses: "Syllabus",
  marks: "Marks",
}

const STATUS_LABEL: Record<ImportStatus, string> = {
  committed: "Committed",
  failed: "Failed",
}

const STATUS_CHIP: Record<ImportStatus, string> = {
  committed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
}

const byCode = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code)

function NextAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {label}
    </Link>
  )
}

export async function AdminDashboard({
  user,
  today,
  denied,
}: {
  user: SessionUser
  today: string
  denied?: string
}) {
  const deptCodes = (await listDepartments())
    .filter((d) => d.isActive)
    .map((d) => d.code)

  const seesAudit = can(user, "audit:read")
  const seesDept = can(user, "dept:read")
  const seesStudents = can(user, "student:read")

  const [health, registers, marks, audit, imports, trend, pendingEnrolments] =
    await Promise.all([
      getDeptHealth(deptCodes),
      registersTodayByDept(deptCodes, today),
      marksCompletionByDept(deptCodes),
      seesAudit ? recentAuditEntries(8) : Promise.resolve<AuditEntry[]>([]),
      recentImportBatchesForScope(user, 5),
      attendanceTrendByScope({ deptCodes }, 14),
      pendingEnrolmentsForDepts(deptCodes),
    ])

  const attention = groupAttention(
    buildAttention({ classWork: [], deptHealth: health, today })
  )

  const totals = health.reduce(
    (acc, d) => ({
      classes: acc.classes + d.classes,
      faculty: acc.faculty + d.faculty,
      students: acc.students + d.students,
      unclaimed: acc.unclaimed + d.unclaimedStudents,
    }),
    { classes: 0, faculty: 0, students: 0, unclaimed: 0 }
  )

  const depts = [...health].sort(byCode)
  const marksRows = [...marks].sort(byCode).filter((m) => m.offerings > 0)

  const registersMarked = registers.reduce((n, r) => n + r.classesMarked, 0)
  const registersTotal = registers.reduce((n, r) => n + r.classes, 0)
  const registerBars = [...registers]
    .sort(byCode)
    .filter((r) => r.classes > 0)
    .map((r) => ({
      label: r.code,
      value: Math.round((r.classesMarked / r.classes) * 100),
      total: 100,
    }))

  const trendPoints = trend.map((p) => ({
    date: DAY.format(new Date(`${p.dateKey}T00:00:00+05:30`)),
    value: p.marked > 0 ? Math.round((p.present / p.marked) * 100) : 0,
  }))

  return (
    <>
      <PageHeader title="Overview" />
      {denied && <DeniedToast scope={denied} />}
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {user.name || user.email}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {deptCodes.length > 0
              ? "Institution operations across every active department."
              : "No departments are set up yet."}
          </p>
        </div>

        <DashGrid>
          <div className="lg:col-span-12">
            <StatCardRow className="lg:grid-cols-6">
              <StatCard
                label="Departments"
                value={deptCodes.length}
                href={seesDept ? "/dashboard/dept" : undefined}
              />
              <StatCard
                label="Classes"
                value={totals.classes}
                href="/dashboard/class"
              />
              <StatCard
                label="Faculty"
                value={totals.faculty}
                href="/dashboard/admin/faculty"
              />
              <StatCard
                label="Students"
                value={totals.students}
                href={seesStudents ? "/dashboard/students" : undefined}
              />
              <StatCard
                label="Never signed in"
                value={totals.unclaimed}
                tone={totals.unclaimed > 0 ? "attention" : "default"}
                href={seesStudents ? "/dashboard/students" : undefined}
              />
              <StatCard
                label="Pending enrolments"
                value={pendingEnrolments}
                tone={pendingEnrolments > 0 ? "attention" : "default"}
                href="/dashboard/class"
              />
            </StatCardRow>
          </div>

          <DashPanel
            title="Department health"
            description="Every active department and what is missing in it."
            href={seesDept ? "/dashboard/dept" : undefined}
            hrefLabel="Open console"
            className="lg:col-span-7"
          >
            {depts.length === 0 ? (
              <EmptyState
                icon={Building2Icon}
                title="No departments yet"
                description="A department has to exist before classes, faculty, or students can hang off it."
                variant="dashed"
                action={
                  <NextAction
                    href="/dashboard/admin/departments"
                    label="Create a department"
                  />
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dept</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>HOD</TableHead>
                    <TableHead className="text-right">Classes</TableHead>
                    <TableHead className="text-right">No coordinator</TableHead>
                    <TableHead className="text-right">Unallocated</TableHead>
                    <TableHead className="text-right">
                      Never signed in
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depts.map((d) => (
                    <TableRow key={d.code} className="relative">
                      <TableCell>
                        <Link
                          href={`/dashboard/dept/${d.code}`}
                          className="identifier focus-visible:after:ring-ring/50 outline-none after:absolute after:inset-0 focus-visible:after:ring-2"
                        >
                          {d.code}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">
                        {d.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[10rem] truncate">
                        {d.hod ?? "Not appointed"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.classes}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          d.classesWithoutCoordinator > 0 &&
                            "text-destructive font-medium"
                        )}
                      >
                        {d.classesWithoutCoordinator}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          d.unallocatedSubjects > 0 &&
                            "text-attention font-medium"
                        )}
                      >
                        {d.unallocatedSubjects}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.unclaimedStudents}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DashPanel>

          <DashPanel
            title="Registers today"
            description={`${registersMarked} of ${registersTotal} classes took attendance today`}
            href="/dashboard/class"
            hrefLabel="Open classes"
            className="lg:col-span-5"
          >
            {registerBars.length === 0 ? (
              <EmptyState
                icon={CalendarCheckIcon}
                title="No classes to take a register for"
                description="Create a class and allocate its subjects, then the day's registers land here."
                variant="dashed"
                action={
                  <NextAction href="/dashboard/class" label="Open classes" />
                }
              />
            ) : (
              <CompareBars
                data={registerBars}
                valueLabel="Percent of classes"
              />
            )}
          </DashPanel>

          <DashPanel
            title="Marks completion"
            description="Subjects carrying every student's marks, and how many are published."
            className="lg:col-span-5"
          >
            {marksRows.length === 0 ? (
              <EmptyState
                icon={SquarePenIcon}
                title="No subjects allocated yet"
                description="Add courses to the syllabus and allocate them to a class before marks can be entered."
                variant="dashed"
                action={
                  <NextAction
                    href="/dashboard/dept/courses"
                    label="Open syllabus"
                  />
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {marksRows.map((m) => (
                  <Link
                    key={m.code}
                    href={`/dashboard/dept/${m.code}`}
                    className="hover:bg-muted/40 focus-visible:ring-ring/50 -mx-2 flex flex-col gap-1.5 rounded-md px-2 py-1.5 transition-colors outline-none focus-visible:ring-2"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="identifier">{m.code}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {m.offeringsComplete} of {m.offerings} complete ·{" "}
                        {m.offeringsPublished} published
                      </span>
                    </div>
                    <MarksSplitBar
                      segments={[
                        { label: "Complete", value: m.offeringsComplete },
                      ]}
                      total={m.offerings}
                      compact
                    />
                  </Link>
                ))}
              </div>
            )}
          </DashPanel>

          <DashPanel
            title="Needs attention"
            description="Ranked by what blocks somebody else, not by how big the number is."
            className="lg:col-span-7"
          >
            {attention.length === 0 ? (
              <EmptyState
                icon={CircleCheckIcon}
                title="All clear"
                description="Nothing across the institution is waiting on a decision."
                variant="dashed"
                action={
                  <NextAction
                    href="/dashboard/dept"
                    label="Open department console"
                  />
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {attention.map((group) => (
                  <AttentionCard
                    key={group.kind}
                    severity={group.urgency}
                    title={group.title}
                    description={group.detail}
                    scopes={group.scopes}
                    href={group.href}
                  />
                ))}
              </div>
            )}
          </DashPanel>

          <DashPanel
            title="Recent activity"
            description="The last eight recorded actions."
            href={seesAudit ? "/dashboard/audit" : undefined}
            hrefLabel="Open log"
            className="lg:col-span-6"
          >
            {audit.length === 0 ? (
              <EmptyState
                icon={HistoryIcon}
                title="Nothing recorded yet"
                description="Every staff action lands here the moment it happens."
                variant="dashed"
                action={
                  seesAudit ? (
                    <NextAction
                      href="/dashboard/audit"
                      label="Open activity log"
                    />
                  ) : undefined
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                        {STAMP.format(entry.when)}
                      </TableCell>
                      <TableCell className="max-w-[9rem] truncate">
                        {entry.actorName ?? "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.action}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[12rem] truncate">
                        {entry.targetLabel}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DashPanel>

          <DashPanel
            title="Recent imports"
            description="The last five uploads and how they landed."
            href="/dashboard/imports"
            hrefLabel="Open imports"
            className="lg:col-span-6"
          >
            {imports.length === 0 ? (
              <EmptyState
                icon={UploadIcon}
                title="No uploads yet"
                description="Import a roster, a syllabus, or a faculty list and it appears here."
                variant="dashed"
                action={
                  <NextAction
                    href="/dashboard/imports"
                    label="Open import centre"
                  />
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kind</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {imports.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {KIND_LABEL[batch.kind]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">
                        {batch.fileName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {batch.rowCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_CHIP[batch.status]}
                        >
                          {STATUS_LABEL[batch.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DashPanel>

          <DashPanel
            title="Attendance trend"
            description="Percent of marked students present, last 14 session days."
            className="lg:col-span-12"
          >
            {trendPoints.length === 0 ? (
              <EmptyState
                icon={ChartLineIcon}
                title="No registers recorded yet"
                description="Take a register on any class and the trend starts here."
                variant="dashed"
                action={
                  <NextAction href="/dashboard/class" label="Open classes" />
                }
              />
            ) : (
              <TrendLine data={trendPoints} yLabel="Percent present" />
            )}
          </DashPanel>
        </DashGrid>
      </div>
    </>
  )
}
