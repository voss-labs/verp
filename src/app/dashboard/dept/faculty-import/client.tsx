"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  parseCsv,
  buildFacultyRows,
  type FacultyRow,
} from "@/lib/faculty-import"
import { bulkImportFacultyAction } from "../actions"

type Dept = { code: string; name: string }
type Class = { id: string; departmentCode: string; label: string }
type Role = "academic_coordinator" | "tr"

export function FacultyImportClient({
  departments,
  classes,
}: {
  departments: Dept[]
  classes: Class[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [deptCode, setDeptCode] = useState(departments[0]?.code ?? "")
  const [rows, setRows] = useState<FacultyRow[] | null>(null)
  const [source, setSource] = useState<{ name: string; size: number } | null>(
    null
  )
  const [assignClassId, setAssignClassId] = useState("")
  const [assignRole, setAssignRole] = useState<Role>("tr")

  const deptClasses = useMemo(
    () => classes.filter((c) => c.departmentCode === deptCode),
    [classes, deptCode]
  )
  const valid = rows?.filter((r) => r.flags.length === 0) ?? []

  function onFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const grid = parseCsv(String(reader.result ?? ""))
      const parsed = buildFacultyRows(grid)
      if (parsed.length === 0) {
        toast.error("No faculty rows found. Expected name, email, employee ID.")
        setRows(null)
        setSource(null)
        return
      }
      setRows(parsed)
      setSource({ name: file.name, size: file.size })
    }
    reader.readAsText(file)
  }

  function commit() {
    if (!deptCode) {
      toast.error("Pick a department.")
      return
    }
    if (valid.length === 0) {
      toast.error("No valid rows to import.")
      return
    }
    start(async () => {
      const res = await bulkImportFacultyAction({
        deptCode,
        rows: valid.map((r) => ({
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          employeeId: r.employeeId,
        })),
        assignClassId: assignClassId || null,
        assignRole: assignClassId ? assignRole : null,
        file: source,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(
        `${res.created} created, ${res.existing} already present` +
          (res.assigned ? `, ${res.assigned} assigned` : "")
      )
      router.push("/dashboard/dept")
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-4 rounded border p-4">
        {departments.length > 1 && (
          <label className="grid max-w-xs gap-1.5">
            <span className="text-muted-foreground text-xs">Department</span>
            <select
              value={deptCode}
              onChange={(e) => {
                setDeptCode(e.target.value)
                setAssignClassId("")
              }}
              className="border-border h-9 rounded border bg-transparent px-2 text-sm"
            >
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="grid gap-1.5">
          <span className="text-muted-foreground text-xs">
            Faculty CSV (name, email, employee ID)
          </span>
          <input
            type="file"
            aria-label="Faculty CSV (name, email, employee ID)"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
            className="file:border-border file:bg-muted text-sm file:mr-3 file:rounded file:border file:px-3 file:py-1.5 file:text-sm"
          />
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-muted-foreground text-xs">
              Assign to class (optional)
            </span>
            <select
              value={assignClassId}
              onChange={(e) => setAssignClassId(e.target.value)}
              className="border-border h-9 rounded border bg-transparent px-2 text-sm"
            >
              <option value="">Don&apos;t assign</option>
              {deptClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {assignClassId && (
            <label className="grid gap-1.5">
              <span className="text-muted-foreground text-xs">As</span>
              <select
                value={assignRole}
                onChange={(e) => setAssignRole(e.target.value as Role)}
                className="border-border h-9 rounded border bg-transparent px-2 text-sm"
              >
                <option value="tr">TR</option>
                <option value="academic_coordinator">Coordinator</option>
              </select>
            </label>
          )}
        </div>
        {assignClassId && (
          <p className="text-muted-foreground text-xs">
            A class has one coordinator and one TR — with multiple rows, only
            the last stays assigned.
          </p>
        )}
      </div>

      {rows && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {rows.length} rows · {valid.length} ready
            </p>
            <Button
              size="sm"
              disabled={pending || valid.length === 0}
              onClick={commit}
            >
              {pending ? "Importing…" : `Import ${valid.length} faculty`}
            </Button>
          </div>
          <div className="border-border overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                  <th>First name</th>
                  <th>Last name</th>
                  <th>Email</th>
                  <th>Employee ID</th>
                  <th className="w-40">Status</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.flags.length
                        ? "text-muted-foreground [&>td]:px-3 [&>td]:py-1.5"
                        : "[&>td]:px-3 [&>td]:py-1.5"
                    }
                  >
                    <td>{r.firstName}</td>
                    <td>{r.lastName}</td>
                    <td className="font-mono text-xs">{r.email}</td>
                    <td className="font-mono text-xs">{r.employeeId}</td>
                    <td>
                      {r.flags.length === 0 ? (
                        <Badge variant="outline">Ready</Badge>
                      ) : (
                        <span className="text-destructive text-xs">
                          {r.flags.join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
