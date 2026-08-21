"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import { Loader2Icon, PlusIcon, UsersIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { ConfirmAction } from "@/components/confirm-action"
import { DataTableView } from "@/components/data-table-view"
import { EmptyState } from "@/components/empty-state"
import { ROLE_LABEL } from "@/components/columns/faculty-columns"
import {
  createFacultyAction,
  setFacultyRoleAction,
  deactivateFacultyAction,
} from "../actions"

type Faculty = {
  id: string
  name: string
  email: string
  employeeId: string
  department: string
  role: "super_admin" | "hod" | "faculty"
}
type Dept = { code: string; name: string }

const TIERS = [
  { value: "faculty", label: "Faculty" },
  { value: "hod", label: "HOD" },
]

const BLANK = {
  firstName: "",
  lastName: "",
  employeeId: "",
  email: "",
  department: "",
  role: "faculty" as "faculty" | "hod",
}

export function FacultyAdminClient({ faculty }: { faculty: Faculty[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const setTier = useCallback(
    (f: Faculty, role: "faculty" | "hod") =>
      start(async () => {
        const res = await setFacultyRoleAction({ facultyId: f.id, role })
        if (res.error) {
          toast.error(res.error)
          return
        }
        toast.success(`${f.name} is now ${ROLE_LABEL[role]}`)
        router.refresh()
      }),
    [router, start]
  )

  const remove = useCallback(
    async (f: Faculty) => {
      const res = await deactivateFacultyAction({ facultyId: f.id })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${f.name} removed`)
      start(() => router.refresh())
    },
    [router, start]
  )

  const columns = useMemo<ColumnDef<Faculty>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="identifier">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "employeeId",
        header: "Employee ID",
        cell: ({ row }) => (
          <span className="identifier">{row.original.employeeId}</span>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => (
          <Badge variant="outline" className="identifier">
            {row.original.department}
          </Badge>
        ),
      },
      {
        accessorKey: "role",
        header: "Tier",
        cell: ({ row }) => {
          const f = row.original
          if (f.role === "super_admin") return <Badge>Super-admin</Badge>
          return (
            <Select
              value={f.role}
              items={TIERS}
              disabled={pending}
              onValueChange={(v) => v && setTier(f, v as "faculty" | "hod")}
            >
              <SelectTrigger
                size="sm"
                className="w-32"
                aria-label={`Tier for ${f.name}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const f = row.original
          return (
            <ConfirmAction
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive text-xs"
                >
                  Remove
                </Button>
              }
              disabled={pending || f.role === "super_admin"}
              title={`Remove ${f.name} from faculty?`}
              description="Their sign-in stays but all VERP access ends."
              confirmLabel="Remove"
              onConfirm={() => remove(f)}
            />
          )
        },
      },
    ],
    [pending, remove, setTier]
  )

  return (
    <DataTableView
      columns={columns}
      data={faculty}
      globalSearch
      searchPlaceholder="Name, email or employee ID…"
      facets={[
        { columnId: "department", label: "Department" },
        {
          columnId: "role",
          label: "Tier",
          format: (v) => ROLE_LABEL[v as Faculty["role"]] ?? v,
        },
      ]}
      emptyContent={
        <EmptyState
          icon={UsersIcon}
          title="No faculty yet"
          description="Add the first one with the button above."
        />
      }
    />
  )
}

export function AddFacultyDialog({ departments }: { departments: Dept[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [f, setF] = useState(BLANK)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const ready =
    f.firstName.trim() !== "" &&
    f.employeeId.trim() !== "" &&
    f.email.trim() !== "" &&
    f.department !== ""

  function submit() {
    start(async () => {
      const res = await createFacultyAction(f)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${f.firstName} ${f.lastName}`.trim() + " added")
      setF(BLANK)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) setF(BLANK)
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Add faculty
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add faculty</DialogTitle>
          <DialogDescription>
            They join the roster immediately and sign in with this email.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="faculty-first-name"
              className="text-muted-foreground text-xs"
            >
              First name
            </FieldLabel>
            <Input
              id="faculty-first-name"
              value={f.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              className="h-9"
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="faculty-last-name"
              className="text-muted-foreground text-xs"
            >
              Last name
            </FieldLabel>
            <Input
              id="faculty-last-name"
              value={f.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              className="h-9"
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="faculty-employee-id"
              className="text-muted-foreground text-xs"
            >
              Employee ID
            </FieldLabel>
            <Input
              id="faculty-employee-id"
              value={f.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
              className="h-9 font-mono"
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="faculty-email"
              className="text-muted-foreground text-xs"
            >
              Email
            </FieldLabel>
            <Input
              id="faculty-email"
              placeholder="name@vit.edu.in"
              value={f.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-9"
            />
          </Field>
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="faculty-department"
              className="text-muted-foreground text-xs"
            >
              Department
            </FieldLabel>
            <Select
              value={f.department}
              items={departments.map((d) => ({
                value: d.code,
                label: `${d.code} — ${d.name}`,
              }))}
              onValueChange={(v) => v && set("department", v)}
            >
              <SelectTrigger
                id="faculty-department"
                size="sm"
                className="h-9 w-full"
              >
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
            <FieldLabel
              htmlFor="faculty-tier"
              className="text-muted-foreground text-xs"
            >
              Tier
            </FieldLabel>
            <Select
              value={f.role}
              items={TIERS}
              onValueChange={(v) => v && set("role", v)}
            >
              <SelectTrigger id="faculty-tier" size="sm" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            Add faculty
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
