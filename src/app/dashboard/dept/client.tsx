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
import { BRANCH_CODE_BY_DEPT, divisionsForBranch } from "@/lib/roll-number"
import {
  createClassAction,
  setClassActiveAction,
  assignCoordinatorAction,
} from "./actions"

type Dept = { code: string; name: string }
type Klass = {
  id: string
  classKey: string
  label: string
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
type Faculty = { id: string; name: string; department: string }

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
    start(async () => {
      const res = await fn()
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (ok) toast.success(ok)
      router.refresh()
    })

  const coordinatorOf = (classId: string) =>
    staff.find(
      (s) => s.classId === classId && s.role === "academic_coordinator"
    )

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
        // A coordinator is picked from faculty in the same department.
        const deptFaculty = faculty.filter((f) => f.department === d.code)
        return (
          <section key={d.code} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {d.code}
              </Badge>
              <h3 className="text-sm font-medium">{d.name}</h3>
            </div>

            <CreateClass deptCode={d.code} disabled={pending} onDone={run} />

            <div className="border-border overflow-hidden rounded-lg border">
              {deptClasses.length === 0 ? (
                <p className="text-muted-foreground p-5 text-sm">
                  No classes yet. Create the first cohort above.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {deptClasses.map((c) => {
                    const coord = coordinatorOf(c.id)
                    return (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{c.label}</p>
                          <p className="text-muted-foreground font-mono text-xs">
                            {c.classKey}
                            {!c.isActive && " · inactive"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={coord?.facultyId ?? ""}
                            disabled={pending || deptFaculty.length === 0}
                            onValueChange={(v) =>
                              v &&
                              run(
                                () =>
                                  assignCoordinatorAction({
                                    classId: c.id,
                                    facultyId: v,
                                  }),
                                "Coordinator assigned"
                              )
                            }
                          >
                            <SelectTrigger size="sm" className="w-52">
                              <SelectValue placeholder="Assign coordinator…" />
                            </SelectTrigger>
                            <SelectContent>
                              {deptFaculty.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            className="text-xs"
                            onClick={() =>
                              run(() =>
                                setClassActiveAction({
                                  classId: c.id,
                                  isActive: !c.isActive,
                                })
                              )
                            }
                          >
                            {c.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
        )
      })}
    </div>
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
    <div className="border-border bg-muted/30 flex flex-wrap items-end gap-2 rounded-xl border p-3">
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">Admission year</label>
        <Input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
          placeholder="2023"
          inputMode="numeric"
          maxLength={4}
          className="h-9 w-28"
        />
      </div>
      <div className="grid gap-1.5">
        <label className="text-muted-foreground text-xs">Division</label>
        <Select value={division} onValueChange={(v) => v && setDivision(v)}>
          <SelectTrigger size="sm" className="h-9 w-20">
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
      </div>
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
