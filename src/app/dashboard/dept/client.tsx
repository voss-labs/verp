"use client"

import Link from "next/link"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronRightIcon,
  EllipsisVerticalIcon,
  LayersIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmAction } from "@/components/confirm-action"
import { EmptyState } from "@/components/empty-state"
import { cn } from "@/lib/utils"
import { BRANCH_CODE_BY_DEPT, divisionsForBranch } from "@/lib/roll-number"
import {
  createClassAction,
  setClassActiveAction,
  graduateClassAction,
  assignClassRoleAction,
  createDeptFacultyAction,
} from "./actions"

type Dept = { code: string; name: string }
type Klass = {
  id: string
  classKey: string
  graduated: boolean
  label: string
  yearDivision: string
  departmentCode: string
  admissionYear: number
  division: string
  isActive: boolean
}
type Staff = {
  classId: string
  role: "academic_coordinator" | "tr"
  facultyId: string
  firstName: string
  lastName: string
}
type Faculty = {
  id: string
  name: string
  department: string
  role: "super_admin" | "hod" | "faculty"
}

const HEAD =
  "bg-surface sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--border)]"

export function DeptClient({
  departments,
  classes,
  staff,
  faculty,
}: {
  departments: Dept[]
  classes: Klass[]
  staff: Staff[]
  faculty: Faculty[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ error: string | null }>, ok?: string) =>
    new Promise<void>((resolve) => {
      start(async () => {
        try {
          const res = await fn()
          if (res.error) {
            toast.error(res.error)
            return
          }
          if (ok) toast.success(ok)
          router.refresh()
        } finally {
          resolve()
        }
      })
    })

  const coordinatorOf = (classId: string) =>
    staff.find(
      (s) => s.classId === classId && s.role === "academic_coordinator"
    )
  const trOf = (classId: string) =>
    staff.find((s) => s.classId === classId && s.role === "tr")

  if (departments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You are not assigned to a department yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {departments.map((d) => {
        const deptClasses = classes.filter((c) => c.departmentCode === d.code)
        // A class coordinator is a teaching faculty in this department — never the
        // HOD or an admin, so filter to the plain faculty tier.
        const deptFaculty = faculty.filter(
          (f) => f.department === d.code && f.role === "faculty"
        )
        return (
          <section key={d.code} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="identifier">
                {d.code}
              </Badge>
              <h3 className="text-sm font-medium">{d.name}</h3>
              <Link
                href={`/dashboard/dept/${d.code}`}
                className="text-blue ml-auto text-xs underline-offset-2 hover:underline"
              >
                Department dashboard →
              </Link>
            </div>

            <div className="border-border overflow-hidden rounded-lg border [&>[data-slot=table-container]]:max-h-[65svh]">
              {deptClasses.length === 0 ? (
                <EmptyState
                  icon={LayersIcon}
                  title="No classes yet"
                  description="Create the first cohort from Add class below."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={HEAD}>Class</TableHead>
                      <TableHead className={HEAD}>Coordinator</TableHead>
                      <TableHead className={HEAD}>Teacher (TR)</TableHead>
                      <TableHead className={cn(HEAD, "w-10 text-right")}>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deptClasses.map((c) => (
                      <ClassRow
                        key={c.id}
                        klass={c}
                        faculty={deptFaculty}
                        coordinatorId={coordinatorOf(c.id)?.facultyId}
                        trId={trOf(c.id)?.facultyId}
                        pending={pending}
                        run={run}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Disclosure label="Add class">
                <CreateClass
                  deptCode={d.code}
                  disabled={pending}
                  onDone={run}
                />
              </Disclosure>
              <Disclosure label="Add faculty">
                <AddDeptFaculty
                  deptCode={d.code}
                  disabled={pending}
                  onDone={run}
                />
              </Disclosure>
            </div>
          </section>
        )
      })}
    </div>
  )
}

type Run = (
  fn: () => Promise<{ error: string | null }>,
  ok?: string
) => Promise<void>

function ClassRow({
  klass: c,
  faculty,
  coordinatorId,
  trId,
  pending,
  run,
}: {
  klass: Klass
  faculty: Faculty[]
  coordinatorId: string | undefined
  trId: string | undefined
  pending: boolean
  run: Run
}) {
  const items = faculty.map((f) => ({ value: f.id, label: f.name }))

  const picker = (
    role: "academic_coordinator" | "tr",
    current: string | undefined,
    aria: string,
    placeholder: string,
    attention?: boolean
  ) => (
    <Select
      value={current ?? ""}
      items={items}
      disabled={pending || faculty.length === 0}
      onValueChange={(v) =>
        v &&
        run(
          () => assignClassRoleAction({ classId: c.id, facultyId: v, role }),
          "Assigned"
        )
      }
    >
      <SelectTrigger
        className={cn(
          "w-52",
          attention && !current && "data-placeholder:text-attention"
        )}
        aria-label={`${aria} for ${c.label}`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {faculty.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="identifier font-medium">{c.classKey}</span>
            {!c.isActive && <Badge variant="secondary">Inactive</Badge>}
            {c.graduated && (
              <Badge variant="secondary" className="bg-blue/10 text-blue">
                Graduated
              </Badge>
            )}
          </div>
          <span className="text-muted-foreground text-xs">
            {c.yearDivision}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {picker(
          "academic_coordinator",
          coordinatorId,
          "Coordinator",
          "Assign coordinator",
          true
        )}
      </TableCell>
      <TableCell>{picker("tr", trId, "Teacher (TR)", "Unassigned")}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                className="text-muted-foreground data-open:bg-muted"
                aria-label={`Actions for ${c.label}`}
              />
            }
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {c.isActive ? (
              <ConfirmAction
                disabled={pending}
                trigger={
                  <DropdownMenuItem closeOnClick={false} variant="destructive">
                    Deactivate
                  </DropdownMenuItem>
                }
                title={`Deactivate ${c.label}?`}
                description={`${c.classKey} drops out of the active class lists. Its roster, marks and attendance stay on record.`}
                confirmLabel="Deactivate"
                onConfirm={() =>
                  run(() =>
                    setClassActiveAction({ classId: c.id, isActive: false })
                  )
                }
              />
            ) : (
              <DropdownMenuItem
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setClassActiveAction({ classId: c.id, isActive: true })
                  )
                }
              >
                Reactivate
              </DropdownMenuItem>
            )}
            {c.graduated ? (
              <DropdownMenuItem
                disabled={pending}
                onClick={() =>
                  run(() =>
                    graduateClassAction({ classId: c.id, graduated: false })
                  )
                }
              >
                Undo graduation
              </DropdownMenuItem>
            ) : (
              <ConfirmAction
                disabled={pending}
                trigger={
                  <DropdownMenuItem closeOnClick={false} variant="destructive">
                    Graduate
                  </DropdownMenuItem>
                }
                title={`Graduate ${c.label}?`}
                description="Students move out of the active roster. The class stays on record and the change can be undone."
                confirmLabel="Graduate"
                onConfirm={() =>
                  run(() =>
                    graduateClassAction({ classId: c.id, graduated: true })
                  )
                }
              />
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function Disclosure({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Collapsible className="border-border group/disclosure overflow-hidden rounded-lg border">
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/40 flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium transition-colors"
          >
            <ChevronRightIcon className="size-3.5 transition-transform duration-200 group-data-open/disclosure:rotate-90" />
            {label}
          </button>
        }
      />
      <CollapsibleContent className="border-border border-t p-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function CreateClass({
  deptCode,
  disabled,
  onDone,
}: {
  deptCode: string
  disabled: boolean
  onDone: (fn: () => Promise<{ error: string | null }>, ok?: string) => void
}) {
  const branchCode = BRANCH_CODE_BY_DEPT[deptCode]
  const divisions = branchCode ? divisionsForBranch(branchCode) : ["A", "B"]
  const [year, setYear] = useState("")
  const [division, setDivision] = useState(divisions[0])

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1.5">
        <span className="text-muted-foreground text-xs">Admission year</span>
        <Input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
          placeholder="2023"
          inputMode="numeric"
          maxLength={4}
          className="h-9 w-28"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-muted-foreground text-xs">Division</span>
        <Select value={division} onValueChange={(v) => v && setDivision(v)}>
          <SelectTrigger className="h-9 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {divisions.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <Button
        className="h-9"
        disabled={disabled || year.length !== 4}
        onClick={() =>
          onDone(
            () =>
              createClassAction({
                deptCode,
                admissionYear: Number(year),
                division,
              }),
            "Class created"
          )
        }
      >
        Add class
      </Button>
    </div>
  )
}

function AddDeptFaculty({
  deptCode,
  disabled,
  onDone,
}: {
  deptCode: string
  disabled: boolean
  onDone: (fn: () => Promise<{ error: string | null }>, ok?: string) => void
}) {
  const empty = { firstName: "", lastName: "", employeeId: "", email: "" }
  const [f, setF] = useState(empty)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  const ready = f.firstName.trim() && f.employeeId.trim() && f.email.trim()

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div
        role="group"
        aria-label="Add faculty"
        className="flex flex-wrap gap-2"
      >
        <Input
          placeholder="First name"
          value={f.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          className="h-9 w-28"
        />
        <Input
          placeholder="Last name"
          value={f.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          className="h-9 w-28"
        />
        <Input
          placeholder="Employee ID"
          value={f.employeeId}
          onChange={(e) => set("employeeId", e.target.value)}
          className="h-9 w-32"
        />
        <Input
          placeholder="name@vit.edu.in"
          value={f.email}
          onChange={(e) => set("email", e.target.value)}
          className="h-9 w-44"
        />
      </div>
      <Button
        className="h-9"
        disabled={disabled || !ready}
        onClick={() =>
          onDone(async () => {
            const res = await createDeptFacultyAction({ deptCode, ...f })
            if (!res.error) setF(empty)
            return res
          }, "Faculty added")
        }
      >
        Add
      </Button>
    </div>
  )
}
