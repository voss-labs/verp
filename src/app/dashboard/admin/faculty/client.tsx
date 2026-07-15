"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createFacultyAction,
  setFacultyRoleAction,
  deactivateFacultyAction,
  appointAction,
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
type Appt = {
  deptCode: string
  appointment: "hod" | "coordinator"
  facultyId: string
  firstName: string
  lastName: string
  email: string
}

const ROLE_LABEL = {
  super_admin: "Super-admin",
  hod: "HOD",
  faculty: "Faculty",
} as const

export function FacultyAdminClient({
  faculty,
  departments,
  appointments,
}: {
  faculty: Faculty[]
  departments: Dept[]
  appointments: Appt[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ error: string | null }>, ok?: string) =>
    start(async () => {
      const res = await fn()
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (ok) toast.success(ok)
      router.refresh()
    })

  const apptFor = (deptCode: string, kind: "hod" | "coordinator") =>
    appointments.find((a) => a.deptCode === deptCode && a.appointment === kind)

  return (
    <div className="flex flex-col gap-8">
      <AddFaculty
        departments={departments}
        disabled={pending}
        onDone={() => router.refresh()}
      />

      {/* ── Roster ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-medium">Faculty ({faculty.length})</h3>
        <div className="border-border mt-3 overflow-hidden rounded-lg border">
          {faculty.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No faculty yet. Add one above.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {faculty.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {f.email} · {f.employeeId} ·{" "}
                      <span className="font-mono">{f.department}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.role === "super_admin" ? (
                      <Badge>Super-admin</Badge>
                    ) : (
                      <Select
                        value={f.role}
                        disabled={pending}
                        onValueChange={(v) =>
                          v &&
                          run(
                            () =>
                              setFacultyRoleAction({
                                facultyId: f.id,
                                role: v as "faculty" | "hod",
                              }),
                            `${f.name} is now ${ROLE_LABEL[v as "faculty" | "hod"]}`
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="faculty">Faculty</SelectItem>
                          <SelectItem value="hod">HOD</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || f.role === "super_admin"}
                      className="text-muted-foreground hover:text-destructive text-xs"
                      onClick={() =>
                        run(() => deactivateFacultyAction({ facultyId: f.id }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Appointments ───────────────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-medium">Department leadership</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Appoint the HOD and coordinator for each department. HOD promotes the
          faculty&rsquo;s tier automatically.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {departments.map((d) => (
            <div
              key={d.code}
              className="border-border bg-card rounded-xl border p-4"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {d.code}
                </Badge>
                <span className="text-sm">{d.name}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(["hod", "coordinator"] as const).map((kind) => {
                  const cur = apptFor(d.code, kind)
                  return (
                    <div key={kind} className="grid gap-1.5">
                      <label className="text-muted-foreground text-xs capitalize">
                        {kind}
                        {cur && (
                          <span className="text-foreground ml-1">
                            — {cur.firstName} {cur.lastName}
                          </span>
                        )}
                      </label>
                      <Select
                        value={cur?.facultyId ?? ""}
                        disabled={pending || faculty.length === 0}
                        onValueChange={(v) =>
                          v &&
                          run(
                            () =>
                              appointAction({
                                deptCode: d.code,
                                facultyId: v,
                                appointment: kind,
                              }),
                            `${kind} appointed`
                          )
                        }
                      >
                        <SelectTrigger size="sm">
                          <SelectValue placeholder="Appoint…" />
                        </SelectTrigger>
                        <SelectContent>
                          {faculty.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {departments.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Create departments first.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function AddFaculty({
  departments,
  disabled,
  onDone,
}: {
  departments: Dept[]
  disabled: boolean
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [f, setF] = useState({
    firstName: "",
    lastName: "",
    employeeId: "",
    email: "",
    department: "",
    role: "faculty" as "faculty" | "hod",
  })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  function submit() {
    start(async () => {
      const res = await createFacultyAction(f)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Faculty added")
      setF({
        firstName: "",
        lastName: "",
        employeeId: "",
        email: "",
        department: "",
        role: "faculty",
      })
      onDone()
    })
  }

  return (
    <section className="border-border bg-muted/30 rounded-xl border p-4">
      <h3 className="text-sm font-medium">Add faculty</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          placeholder="First name"
          value={f.firstName}
          onChange={(e) => set("firstName", e.target.value)}
          className="h-9"
        />
        <Input
          placeholder="Last name"
          value={f.lastName}
          onChange={(e) => set("lastName", e.target.value)}
          className="h-9"
        />
        <Input
          placeholder="Employee ID"
          value={f.employeeId}
          onChange={(e) => set("employeeId", e.target.value)}
          className="h-9"
        />
        <Input
          placeholder="name@vit.edu.in"
          value={f.email}
          onChange={(e) => set("email", e.target.value)}
          className="h-9"
        />
        <Select
          value={f.department}
          onValueChange={(v) => v && set("department", v)}
        >
          <SelectTrigger size="sm" className="h-9">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.code} value={d.code}>
                {d.code} — {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={f.role} onValueChange={(v) => v && set("role", v)}>
          <SelectTrigger size="sm" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="faculty">Faculty</SelectItem>
            <SelectItem value="hod">HOD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button
        className="mt-3 h-9"
        disabled={disabled || pending}
        onClick={submit}
      >
        Add faculty
      </Button>
    </section>
  )
}
