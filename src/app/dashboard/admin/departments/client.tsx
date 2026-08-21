"use client"

import { useState, useTransition } from "react"
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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
type Dept = { code: string; name: string; isActive: boolean; hod: Hod | null }
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

      <div className="border-border overflow-hidden rounded-lg border">
        {departments.length === 0 ? (
          <EmptyState
            icon={BuildingIcon}
            title="No departments yet"
            description="Add the five branches above."
          />
        ) : (
          <>
            <div className="text-muted-foreground border-border bg-muted/30 hidden items-center gap-4 border-b px-4 py-2 text-xs sm:flex">
              <span className="min-w-0 flex-1">Department</span>
              <span className="w-44 shrink-0">Head of department</span>
              <span className="w-44 shrink-0" aria-hidden />
            </div>
            <ul className="divide-border divide-y">
              {departments.map((d) => (
                <li
                  key={d.code}
                  className="flex flex-wrap items-center gap-4 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Badge variant="outline" className="identifier">
                      {d.code}
                    </Badge>
                    <span className="truncate text-sm">{d.name}</span>
                    {!d.isActive && (
                      <span className="text-muted-foreground text-xs">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="w-44 shrink-0">
                    {d.hod ? (
                      <span className="block truncate text-sm">
                        {d.hod.name}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-attention">
                        <CircleAlertIcon data-icon="inline-start" />
                        No HOD
                      </Badge>
                    )}
                  </div>
                  <div className="flex w-44 shrink-0 items-center justify-end gap-1">
                    {d.isActive && (
                      <AppointHod
                        dept={d}
                        faculty={faculty}
                        disabled={pending}
                        onDone={() => start(() => router.refresh())}
                      />
                    )}
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
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
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
        render={<Button variant="ghost" size="sm" className="text-xs" />}
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
