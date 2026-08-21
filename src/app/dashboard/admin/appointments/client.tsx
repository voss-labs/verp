"use client"

import Link from "next/link"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowRightIcon, BuildingIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/empty-state"
import { appointHodAction, appointCoordinatorAction } from "../actions"

type Person = { id: string; name: string; department: string }
type Dept = { code: string; name: string }
type Appt = {
  deptCode: string
  appointment: "hod" | "coordinator"
  facultyId: string
  firstName: string
  lastName: string
  email: string
}

const KINDS = ["hod", "coordinator"] as const

const KIND_LABEL = { hod: "HOD", coordinator: "Coordinator" } as const

export function AppointmentsClient({
  departments,
  faculty,
  appointments,
}: {
  departments: Dept[]
  faculty: Person[]
  appointments: Appt[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const appointmentFor = (deptCode: string, kind: (typeof KINDS)[number]) =>
    appointments.find((a) => a.deptCode === deptCode && a.appointment === kind)

  function appoint(
    dept: Dept,
    kind: (typeof KINDS)[number],
    person: Person | undefined
  ) {
    if (!person) return
    start(async () => {
      const res =
        kind === "hod"
          ? await appointHodAction({
              deptCode: dept.code,
              facultyId: person.id,
            })
          : await appointCoordinatorAction({
              deptCode: dept.code,
              facultyId: person.id,
            })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${person.name} is now ${KIND_LABEL[kind]} of ${dept.code}`)
      router.refresh()
    })
  }

  if (departments.length === 0) {
    return (
      <EmptyState
        icon={BuildingIcon}
        variant="dashed"
        title="No active departments"
        description="Leadership is appointed per department. Create one first."
        action={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/dashboard/admin/departments" />}
          >
            Go to departments
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {faculty.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Nobody is on the roster yet. Add faculty before appointing anyone.
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {departments.map((d) => {
          const deptFaculty = faculty.filter((f) => f.department === d.code)
          return (
            <div
              key={d.code}
              className="border-border bg-card rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="identifier">
                    {d.code}
                  </Badge>
                  <span className="truncate text-sm">{d.name}</span>
                </div>
                <Link
                  href="/dashboard/admin/departments"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-1 rounded text-xs outline-none focus-visible:ring-2"
                >
                  Department
                  <ArrowRightIcon className="size-3" />
                </Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {KINDS.map((kind) => {
                  const current = appointmentFor(d.code, kind)
                  const id = `${d.code}-${kind}`
                  return (
                    <div key={kind} className="grid gap-1.5">
                      <label
                        htmlFor={id}
                        className="text-muted-foreground text-xs"
                      >
                        {KIND_LABEL[kind]}
                      </label>
                      <Select
                        value={current?.facultyId ?? ""}
                        items={deptFaculty.map((f) => ({
                          value: f.id,
                          label: f.name,
                        }))}
                        disabled={pending || deptFaculty.length === 0}
                        onValueChange={(v) =>
                          appoint(
                            d,
                            kind,
                            deptFaculty.find((f) => f.id === v)
                          )
                        }
                      >
                        <SelectTrigger id={id} size="sm" className="w-full">
                          <SelectValue placeholder="Appoint…" />
                        </SelectTrigger>
                        <SelectContent>
                          {deptFaculty.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-muted-foreground truncate text-xs">
                        {current ? current.email : "Nobody appointed"}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
