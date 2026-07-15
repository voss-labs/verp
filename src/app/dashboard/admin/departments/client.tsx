"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createDepartmentAction, setDepartmentActiveAction } from "../actions"

type Dept = { code: string; name: string; isActive: boolean }

// VIT's five branches, with their full names for quick-add.
const KNOWN: { code: string; name: string }[] = [
  { code: "IT", name: "Information Technology" },
  { code: "CMPN", name: "Computer Engineering" },
  { code: "EXCS", name: "Electronics & Computer Science" },
  { code: "EXTC", name: "Electronics & Telecommunication" },
  { code: "BIOMED", name: "Biomedical Engineering" },
]

export function DepartmentsClient({ departments }: { departments: Dept[] }) {
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

  function toggle(d: Dept) {
    start(async () => {
      const res = await setDepartmentActiveAction({
        code: d.code,
        isActive: !d.isActive,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      router.refresh()
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
                {k.code}
                <span className="text-muted-foreground ml-1.5 font-normal">
                  {k.name}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <label className="text-muted-foreground text-xs">Code</label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="EXCS"
            className="h-9 w-28 font-mono uppercase"
          />
        </div>
        <div className="grid flex-1 gap-1.5">
          <label className="text-muted-foreground text-xs">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Electronics & Computer Science"
            className="h-9"
          />
        </div>
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
          <p className="text-muted-foreground p-6 text-sm">
            No departments yet. Add the five branches above.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {departments.map((d) => (
              <li
                key={d.code}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">
                    {d.code}
                  </Badge>
                  <span className="text-sm">{d.name}</span>
                  {!d.isActive && (
                    <span className="text-muted-foreground text-xs">
                      inactive
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => toggle(d)}
                  className="text-xs"
                >
                  {d.isActive ? "Deactivate" : "Reactivate"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
