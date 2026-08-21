"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  BuildingIcon,
  CircleAlertIcon,
  Loader2Icon,
  PlusIcon,
  UsersIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ConfirmAction } from "@/components/confirm-action"
import { EmptyState } from "@/components/empty-state"
import {
  createDepartmentAction,
  setDepartmentActiveAction,
  appointHodAction,
} from "../actions"

type Hod = { id: string; name: string }
type Dept = {
  code: string
  name: string
  isActive: boolean
  hod: Hod | null
  coordinators: string[]
  students: number
  faculty: number
  classes: number
  classesWithoutCoordinator: number
  unallocatedSubjects: number
}
type Person = {
  id: string
  name: string
  employeeId: string
  department: string
}

// VIT's five branches, with their full names for quick-add.
const KNOWN: { code: string; name: string }[] = [
  { code: "IT", name: "Information Technology" },
  { code: "CMPN", name: "Computer Engineering" },
  { code: "EXCS", name: "Electronics & Computer Science" },
  { code: "EXTC", name: "Electronics & Telecommunication" },
  { code: "BIOMED", name: "Biomedical Engineering" },
]

export function DepartmentsClient({
  departments,
  faculty,
}: {
  departments: Dept[]
  faculty: Person[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")

  const existing = new Set(departments.map((d) => d.code))
  const missing = KNOWN.filter((k) => !existing.has(k.code))

  function create(c: string, n: string) {
    start(async () => {
      const res = await createDepartmentAction({ code: c, name: n })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${c} created`)
      setCode("")
      setName("")
      router.refresh()
    })
  }

  async function setActive(d: Dept, isActive: boolean) {
    const res = await setDepartmentActiveAction({
      code: d.code,
      isActive,
    })
    if (res.error) {
      toast.error(res.error)
      return
    }
    start(() => router.refresh())
  }

  function reactivate(d: Dept) {
    start(async () => {
      await setActive(d, true)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {missing.length > 0 && (
        <div className="border-border bg-muted/30 rounded-xl border p-4">
          <p className="text-sm font-medium">Quick-add VIT branches</p>
          <p className="text-muted-foreground mt-1 text-xs">
            The standard five. Add the ones you haven&rsquo;t created yet.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missing.map((k) => (
              <Button
                key={k.code}
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => create(k.code, k.name)}
              >
                <PlusIcon className="mr-1.5 size-3.5" />
                <span className="identifier">{k.code}</span>
                <span className="text-muted-foreground ml-1.5 font-normal">
                  {k.name}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Field className="w-28 gap-1.5">
          <FieldLabel
            htmlFor="department-code"
            className="text-muted-foreground text-xs"
          >
            Code
          </FieldLabel>
          <Input
            id="department-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EXCS"
            className="h-9 font-mono uppercase"
          />
        </Field>
        <Field className="flex-1 gap-1.5">
          <FieldLabel
            htmlFor="department-name"
            className="text-muted-foreground text-xs"
          >
            Name
          </FieldLabel>
          <Input
            id="department-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Electronics & Computer Science"
            className="h-9"
          />
        </Field>
        <Button
          disabled={pending || !code || !name}
          onClick={() => create(code, name)}
          className="h-9"
        >
          Add department
        </Button>
      </div>

      {departments.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          variant="dashed"
          title="No departments yet"
          description="Add the five branches above."
        />
      ) : (
        <div className="grid gap-4 @3xl/main:grid-cols-2">
          {departments.map((d) => (
            <Card key={d.code} className="h-full">
              <CardHeader>
                <CardTitle className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="identifier">
                    {d.code}
                  </Badge>
                  <span className="truncate">{d.name}</span>
                </CardTitle>
                {!d.isActive && (
                  <CardAction>
                    <Badge variant="secondary">Inactive</Badge>
                  </CardAction>
                )}
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="border-border divide-border grid grid-cols-3 divide-x rounded-lg border">
                  <DeptStat label="Students" value={d.students} />
                  <DeptStat label="Faculty" value={d.faculty} />
                  <DeptStat label="Classes" value={d.classes} />
                </div>

                {(d.classesWithoutCoordinator > 0 ||
                  d.unallocatedSubjects > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {d.classesWithoutCoordinator > 0 && (
                      <Badge
                        variant="outline"
                        className="text-attention"
                        render={
                          <Link
                            href={`/dashboard/dept/${d.code}?tab=classes`}
                          />
                        }
                      >
                        <CircleAlertIcon data-icon="inline-start" />
                        {d.classesWithoutCoordinator} without coordinator
                      </Badge>
                    )}
                    {d.unallocatedSubjects > 0 && (
                      <Badge
                        variant="outline"
                        className="text-attention"
                        render={
                          <Link
                            href={`/dashboard/dept/${d.code}?tab=classes`}
                          />
                        }
                      >
                        <CircleAlertIcon data-icon="inline-start" />
                        {d.unallocatedSubjects} unallocated subjects
                      </Badge>
                    )}
                  </div>
                )}

                <div className="border-border mt-auto flex flex-col gap-3 border-t pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">
                        Head of department
                      </p>
                      {d.hod ? (
                        <p className="mt-1 truncate text-sm">{d.hod.name}</p>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-attention mt-1"
                        >
                          <CircleAlertIcon data-icon="inline-start" />
                          No HOD
                        </Badge>
                      )}
                    </div>
                    {d.isActive && (
                      <AppointHod
                        dept={d}
                        faculty={faculty}
                        disabled={pending}
                        onDone={() => start(() => router.refresh())}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">
                      {d.coordinators.length > 1
                        ? "Department coordinators"
                        : "Department coordinator"}
                    </p>
                    <p className="mt-1 truncate text-sm">
                      {d.coordinators.length > 0 ? (
                        d.coordinators.join(", ")
                      ) : (
                        <span className="text-muted-foreground">
                          Not appointed
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="justify-between gap-2">
                <Link
                  href={`/dashboard/dept/${d.code}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open
                </Link>
                {d.isActive ? (
                  <ConfirmAction
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive text-xs"
                      >
                        Deactivate
                      </Button>
                    }
                    disabled={pending}
                    title={`Deactivate ${d.name}?`}
                    description={`It stops appearing wherever a department is chosen. Existing records keep their ${d.code} tag, and you can reactivate it here.`}
                    confirmLabel="Deactivate"
                    onConfirm={() => setActive(d, false)}
                  />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => reactivate(d)}
                    className="text-xs"
                  >
                    Reactivate
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function DeptStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  )
}

function AppointHod({
  dept,
  faculty,
  disabled,
  onDone,
}: {
  dept: Dept
  faculty: Person[]
  disabled: boolean
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Person | null>(null)
  const [busy, setBusy] = useState(false)

  function close(next: boolean) {
    if (busy) return
    setOpen(next)
    if (!next) setPicked(null)
  }

  async function confirm() {
    if (!picked || busy) return
    setBusy(true)
    try {
      const res = await appointHodAction({
        deptCode: dept.code,
        facultyId: picked.id,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${picked.name} now heads ${dept.code}`)
      setOpen(false)
      setPicked(null)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger
        disabled={disabled}
        render={
          <Button variant="outline" size="sm" className="shrink-0 text-xs" />
        }
      >
        {dept.hod ? "Change" : "Appoint"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {picked ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Appoint {picked.name} as HOD of {dept.code}?
              </DialogTitle>
              <DialogDescription>
                <span className="identifier">{picked.employeeId}</span> ·{" "}
                {picked.department}.{" "}
                {dept.hod
                  ? `This replaces ${dept.hod.name} and takes effect immediately.`
                  : "It takes effect immediately."}{" "}
                Their tier becomes HOD and {dept.code} enters their scope.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setPicked(null)}
              >
                Back
              </Button>
              <Button disabled={busy} onClick={confirm}>
                {busy && (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                Appoint
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {dept.hod ? "Change the HOD" : "Appoint an HOD"} of {dept.code}
              </DialogTitle>
              <DialogDescription>
                {dept.hod
                  ? `${dept.hod.name} heads ${dept.code} today. Pick their successor from any department.`
                  : `Nobody heads ${dept.code} yet. Pick anyone from any department.`}
              </DialogDescription>
            </DialogHeader>
            {faculty.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                variant="dashed"
                title="No faculty on the roster"
                description="Add staff on the Faculty page first."
              />
            ) : (
              <Command className="border-border rounded-lg border p-1">
                <CommandInput placeholder="Name or employee ID…" />
                <CommandList>
                  <CommandEmpty>Nobody matches that.</CommandEmpty>
                  <CommandGroup>
                    {faculty.map((f) => (
                      <CommandItem
                        key={f.id}
                        value={`${f.name} ${f.employeeId} ${f.department}`}
                        onSelect={() => setPicked(f)}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {f.name}
                        </span>
                        <span className="identifier text-muted-foreground shrink-0">
                          {f.employeeId}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {f.department}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
