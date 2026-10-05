"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DataTableView } from "@/components/data-table-view"
import {
  studentsColumns,
  type StudentRow,
} from "@/components/columns/students-columns"
import { exportTableCsv, exportTableXlsx } from "@/lib/xlsx-export"
import { downloadBase64File } from "@/lib/utils"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { RecordDialog } from "@/components/record-dialog"
import { RecordHistory } from "@/components/record-history"
import { bulkDeactivateStudentsAction } from "./actions"
import { ConfirmAction } from "@/components/confirm-action"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Department = { code: string; name: string }

export function StudentsClient({
  data,
  canDeactivate,
  canManage,
  department,
  lastImport,
  departments,
}: {
  data: StudentRow[]
  canDeactivate: boolean
  canManage: boolean
  departments: Department[]
  department?: string
  lastImport?: { when: string; by: string } | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState<StudentRow | null>(null)
  const [editing, setEditing] = useState<StudentRow | null>(null)

  async function deactivateOne(student: StudentRow) {
    const response = await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    })
    const body = await response.json()
    if (!response.ok) {
      toast.error(body.error ?? "Could not deactivate student")
      return
    }
    toast.success(
      `${student.firstName} ${student.lastName}`.trim() + " deactivated"
    )
    setOpen(null)
    router.refresh()
  }

  async function reactivateOne(student: StudentRow) {
    const response = await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    })
    const body = await response.json()
    if (!response.ok) {
      toast.error(body.error ?? "Could not reactivate student")
      return
    }
    toast.success(
      `${student.firstName} ${student.lastName}`.trim() + " reactivated"
    )
    setOpen(null)
    router.refresh()
  }

  async function deleteOne(student: StudentRow) {
    const response = await fetch(`/api/students/${student.id}`, {
      method: "DELETE",
    })
    const body = await response.json()
    if (!response.ok) {
      toast.error(body.error ?? "Could not delete student")
      return
    }
    toast.success(
      `${student.firstName} ${student.lastName}`.trim() + " permanently deleted"
    )
    setOpen(null)
    router.refresh()
  }

  function deactivate(ids: string[], clear: () => void) {
    start(async () => {
      const res = await bulkDeactivateStudentsAction({ ids })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Deactivated ${res.count} student(s)`)
      clear()
      router.refresh()
    })
  }

  const handleExport = async (
    filteredData: StudentRow[],
    format: "csv" | "xlsx"
  ) => {
    const headers = [
      "Roll No.",
      "Name",
      "Email",
      "Department",
      "Division",
      "Year",
      "Claimed",
      "Status",
    ]
    const exportRows = filteredData.map((s) => [
      s.rollNumber,
      `${s.firstName} ${s.lastName}`.trim(),
      s.email ?? "-",
      s.department,
      s.division ?? "-",
      s.year,
      s.authUserId ? "Yes" : "No",
      s.isActive ? "Active" : "Inactive",
    ])
    const dateStr = new Date().toISOString().split("T")[0]
    const filename = `Students_${dateStr}.${format}`
    if (format === "xlsx") {
      const base64 = await exportTableXlsx({
        title: "Students",
        headers,
        rows: exportRows,
      })
      downloadBase64File(
        base64,
        filename,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    } else {
      const base64 = await exportTableCsv({ headers, rows: exportRows })
      downloadBase64File(base64, filename, "text/csv")
    }
  }

  return (
    <>
      {lastImport && (
        <p className="text-muted-foreground pb-2 text-xs">
          Last import: {lastImport.when} by {lastImport.by}
        </p>
      )}

      <DataTableView
        columns={studentsColumns}
        data={data}
        globalSearch
        facets={[
          { columnId: "department", label: "Department" },
          { columnId: "year", label: "Year" },
          { columnId: "division", label: "Division" },
          {
            columnId: "isActive",
            label: "Status",
            format: (value) => (value === "true" ? "Active" : "Inactive"),
          },
        ]}
        searchPlaceholder="Search students..."
        initialFilters={
          department ? [{ id: "department", value: department }] : undefined
        }
        exportConfig={{ filename: "Students", onExport: handleExport }}
        rowId={(s) => s.id}
        onRowClick={setOpen}
        mobileRow={(s) => ({
          title: `${s.firstName} ${s.lastName}`.trim(),
          subtitle: s.rollNumber,
          meta: [
            { label: "Dept", value: s.department },
            { label: "Year", value: s.year },
            { label: "Status", value: s.isActive ? "Active" : "Inactive" },
            ...(s.division ? [{ label: "Div", value: s.division }] : []),
            {
              label: "Account",
              value: s.authUserId ? "Claimed" : "Unclaimed",
            },
          ],
        })}
        bulkBar={
          canDeactivate
            ? (ids, clear) => (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  className="text-destructive"
                  onClick={() => deactivate(ids, clear)}
                >
                  <Trash2Icon className="mr-1.5 size-3.5" />
                  Deactivate
                </Button>
              )
            : undefined
        }
      />

      <RecordDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.firstName} ${open.lastName}`.trim() : ""}
        subtitle={open?.email ?? "No email on record"}
        badges={
          open
            ? [
                { label: open.rollNumber },
                ...(open.isActive
                  ? []
                  : [{ label: "Inactive", tone: "critical" as const }]),
                // An unclaimed row is a student who has never signed in, which
                // is the difference between a roster mistake and a person who
                // simply has not arrived yet.
                ...(open.authUserId
                  ? []
                  : [{ label: "Unclaimed", tone: "warn" as const }]),
              ]
            : undefined
        }
        facts={
          open
            ? [
                { label: "Department", value: open.department },
                { label: "Year", value: open.year },
                { label: "Division", value: open.division ?? "—" },
                { label: "Roll number", value: open.rollNumber, mono: true },
              ]
            : undefined
        }
        footer={
          open && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard/students/${open.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open full record
              </Link>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(open)
                    setOpen(null)
                  }}
                >
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Button>
              )}
              {canManage && open.isActive && (
                <ConfirmAction
                  label="Deactivate"
                  size="sm"
                  title={`Deactivate ${open.firstName} ${open.lastName}?`}
                  description="This keeps the record and history but removes the student from active rosters. You can reactivate it later."
                  confirmLabel="Deactivate"
                  onConfirm={() => deactivateOne(open)}
                />
              )}
              {canManage && !open.isActive && (
                <ConfirmAction
                  label="Reactivate"
                  size="sm"
                  destructive={false}
                  title={`Reactivate ${open.firstName} ${open.lastName}?`}
                  description="This returns the student to active rosters."
                  confirmLabel="Reactivate"
                  onConfirm={() => reactivateOne(open)}
                />
              )}
              {canManage && (
                <ConfirmAction
                  label="Delete permanently"
                  size="sm"
                  title={`Permanently delete ${open.firstName} ${open.lastName}?`}
                  description="This permanently removes the student and cascades related marks, attendance, and batch records. This cannot be undone."
                  confirmLabel="Delete permanently"
                  onConfirm={() => deleteOne(open)}
                />
              )}
            </div>
          )
        }
      >
        <RecordHistory targetType="student" targetId={open?.id ?? null} />
      </RecordDialog>
      {editing && (
        <StudentFormDialog
          student={editing}
          departments={departments}
          open
          onOpenChange={(next) => !next && setEditing(null)}
        />
      )}
    </>
  )
}

export function StudentLifecycleActions({
  id,
  name,
  isActive,
}: {
  id: string
  name: string
  isActive: boolean
}) {
  const router = useRouter()

  async function setActive(next: boolean) {
    const response = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    })
    const body = await response.json()
    if (!response.ok) {
      toast.error(
        body.error ?? `Could not ${next ? "reactivate" : "deactivate"} student`
      )
      return
    }
    toast.success(`${name} ${next ? "reactivated" : "deactivated"}`)
    router.refresh()
  }

  async function permanentlyDelete() {
    const response = await fetch(`/api/students/${id}`, { method: "DELETE" })
    const body = await response.json()
    if (!response.ok) {
      toast.error(body.error ?? "Could not delete student")
      return
    }
    toast.success(`${name} permanently deleted`)
    router.push("/dashboard/students")
    router.refresh()
  }

  return (
    <div className="flex flex-wrap gap-2">
      {isActive ? (
        <ConfirmAction
          label="Deactivate"
          size="sm"
          title={`Deactivate ${name}?`}
          description="This keeps the record and history but removes the student from active rosters. You can reactivate it later."
          confirmLabel="Deactivate"
          onConfirm={() => setActive(false)}
        />
      ) : (
        <ConfirmAction
          label="Reactivate"
          size="sm"
          destructive={false}
          title={`Reactivate ${name}?`}
          description="This returns the student to active rosters."
          confirmLabel="Reactivate"
          onConfirm={() => setActive(true)}
        />
      )}
      <ConfirmAction
        label="Delete permanently"
        size="sm"
        title={`Permanently delete ${name}?`}
        description="This permanently removes the student and cascades related marks, attendance, and batch records. This cannot be undone."
        confirmLabel="Delete permanently"
        onConfirm={permanentlyDelete}
      />
    </div>
  )
}

const YEARS = ["FE", "SE", "TE", "BE"] as const
const DIVISIONS = ["A", "B", "C"] as const
const SEMESTERS: Record<(typeof YEARS)[number], string[]> = {
  FE: ["1", "2"],
  SE: ["3", "4"],
  TE: ["5", "6"],
  BE: ["7", "8"],
}

type StudentFormValue = {
  firstName: string
  lastName: string
  rollNumber: string
  email: string
  department: string
  division: string
  year: (typeof YEARS)[number]
  semester: string
}

const blankStudent: StudentFormValue = {
  firstName: "",
  lastName: "",
  rollNumber: "",
  email: "",
  department: "",
  division: "A",
  year: "FE",
  semester: "1",
}

export function StudentFormDialog({
  departments,
  student,
  open: controlledOpen,
  onOpenChange,
}: {
  departments: Department[]
  student?: StudentRow | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const [pending, start] = useTransition()
  const [form, setForm] = useState<StudentFormValue>(() =>
    student
      ? {
          firstName: student.firstName,
          lastName: student.lastName,
          rollNumber: student.rollNumber,
          email: student.email ?? "",
          department: student.department,
          division: student.division ?? "A",
          year: student.year as StudentFormValue["year"],
          semester:
            SEMESTERS[student.year as StudentFormValue["year"]]?.[0] ?? "1",
        }
      : blankStudent
  )
  const isEdit = Boolean(student)
  const open = controlledOpen ?? internalOpen
  const setOpen = (next: boolean) => {
    if (pending) return
    if (!next && !isEdit) setForm(blankStudent)
    onOpenChange?.(next)
    if (controlledOpen === undefined) setInternalOpen(next)
  }
  const set = (key: keyof StudentFormValue, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  function submit() {
    start(async () => {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        rollNumber: form.rollNumber,
        email: form.email || undefined,
        department: form.department,
        division: form.division,
        year: form.year,
      }
      const response = await fetch(
        isEdit ? `/api/students/${student!.id}` : "/api/students",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const body = await response.json()
      if (!response.ok) {
        toast.error(
          body.error ?? `Could not ${isEdit ? "update" : "create"} student`
        )
        return
      }
      toast.success(isEdit ? "Student updated" : "Student added")
      setOpen(false)
      router.refresh()
    })
  }

  const ready =
    form.firstName.trim() &&
    form.rollNumber.trim() &&
    form.department &&
    form.year
  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEdit && (
        <DialogTrigger render={<Button />}>
          <PlusIcon data-icon="inline-start" />
          Add student
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the student roster record."
              : "Add a student to the active roster."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["firstName", "lastName", "rollNumber", "email"] as const).map(
            (key) => (
              <Field key={key} className="gap-1.5">
                <FieldLabel
                  htmlFor={`student-${key}`}
                  className="text-muted-foreground text-xs"
                >
                  {key === "firstName"
                    ? "First name"
                    : key === "lastName"
                      ? "Last name"
                      : key === "rollNumber"
                        ? "Roll number"
                        : "Email"}
                </FieldLabel>
                <Input
                  id={`student-${key}`}
                  type={key === "email" ? "email" : "text"}
                  value={form[key]}
                  onChange={(event) => set(key, event.target.value)}
                  className={key === "rollNumber" ? "h-9 font-mono" : "h-9"}
                />
              </Field>
            )
          )}
          <Field className="gap-1.5">
            <FieldLabel className="text-muted-foreground text-xs">
              Department
            </FieldLabel>
            <Select
              value={form.department}
              onValueChange={(value) => value && set("department", value)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Choose department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel className="text-muted-foreground text-xs">
              Division
            </FieldLabel>
            <Select
              value={form.division}
              onValueChange={(value) => value && set("division", value)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIVISIONS.map((division) => (
                  <SelectItem key={division} value={division}>
                    {division}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel className="text-muted-foreground text-xs">
              Year
            </FieldLabel>
            <Select
              value={form.year}
              onValueChange={(value) => {
                if (
                  value &&
                  YEARS.includes(value as StudentFormValue["year"])
                ) {
                  set("year", value)
                  set(
                    "semester",
                    SEMESTERS[value as StudentFormValue["year"]][0]
                  )
                }
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="gap-1.5">
            <FieldLabel className="text-muted-foreground text-xs">
              Semester
            </FieldLabel>
            <Select
              value={form.semester}
              onValueChange={(value) => value && set("semester", value)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS[form.year].map((semester) => (
                  <SelectItem key={semester} value={semester}>
                    {semester}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Used for academic context; semester is stored on course offerings.
            </p>
          </Field>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button disabled={pending || !ready} onClick={submit}>
            {pending && (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            )}
            {isEdit ? "Save changes" : "Add student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
  return dialog
}
