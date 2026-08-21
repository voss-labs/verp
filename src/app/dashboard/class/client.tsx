"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const YEAR_ORDER = ["FE", "SE", "TE", "BE"]

export type ClassCard = {
  id: string
  classKey: string
  group: string
  deptCode: string
  division: string
  coordinator: string | null
  students: number
  attention: string[]
  isActive: boolean
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

const attentionLabel = (n: number) =>
  `${n} ${n === 1 ? "needs" : "need"} attention`

const wants = (c: ClassCard) => c.attention.length > 0 || !c.coordinator

function groupByYear(cards: ClassCard[]) {
  const groups = new Map<string, ClassCard[]>()
  for (const card of cards) {
    const list = groups.get(card.group) ?? []
    list.push(card)
    groups.set(card.group, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ai = YEAR_ORDER.indexOf(a)
      const bi = YEAR_ORDER.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return b.localeCompare(a)
    })
    .map(([key, items]) => ({
      key,
      items,
      attention: items.filter(wants).length,
    }))
}

function FilterChip({
  label,
  count,
  active,
  mono,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  mono?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-4xl border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className={mono ? "identifier" : undefined}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          active ? "text-background/70" : "text-muted-foreground/70"
        )}
      >
        {count}
      </span>
    </button>
  )
}

export function ClassIndexClient({
  cards,
  assignHref,
}: {
  cards: ClassCard[]
  assignHref: string | null
}) {
  const [dept, setDept] = useState<string | null>(null)

  const depts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of cards)
      counts.set(c.deptCode, (counts.get(c.deptCode) ?? 0) + 1)
    return [...counts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [cards])

  const visible = useMemo(
    () => (dept ? cards.filter((c) => c.deptCode === dept) : cards),
    [cards, dept]
  )
  const groups = useMemo(() => groupByYear(visible), [visible])
  const attention = visible.filter(wants).length

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2",
          depts.length > 1 ? "justify-between" : "justify-end"
        )}
      >
        {depts.length > 1 && (
          <div
            role="group"
            aria-label="Filter by department"
            className="flex flex-wrap items-center gap-1.5"
          >
            <FilterChip
              label="All"
              count={cards.length}
              active={dept === null}
              onClick={() => setDept(null)}
            />
            {depts.map((d) => (
              <FilterChip
                key={d.code}
                label={d.code}
                count={d.count}
                mono
                active={dept === d.code}
                onClick={() => setDept(dept === d.code ? null : d.code)}
              />
            ))}
          </div>
        )}
        <p className="text-muted-foreground text-xs tabular-nums">
          {plural(visible.length, "class", "classes")}
          {attention > 0 && (
            <span className="text-attention">
              {" "}
              · {attentionLabel(attention)}
            </span>
          )}
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2 border-b pb-2">
            <h2 className="text-sm font-semibold">
              {YEAR_ORDER.includes(group.key)
                ? group.key
                : `${group.key} intake`}
            </h2>
            <span className="text-muted-foreground text-xs tabular-nums">
              {plural(group.items.length, "class", "classes")}
            </span>
            {group.attention > 0 && (
              <span className="text-attention text-xs tabular-nums">
                · {attentionLabel(group.attention)}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((c) => (
              <div
                key={c.id}
                className="border-border bg-card hover:border-blue/50 hover:bg-muted/30 relative flex flex-col gap-3 rounded-xl border p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/class/${c.id}`}
                    className="focus-visible:after:ring-ring/50 font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2"
                  >
                    {c.deptCode} · {c.division}
                  </Link>
                  <Badge variant="outline" className="identifier shrink-0">
                    {c.classKey}
                  </Badge>
                </div>
                <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5">
                  <dt className="text-muted-foreground text-xs">Coordinator</dt>
                  <dd className="min-w-0 truncate text-sm">
                    {c.coordinator ? (
                      c.coordinator
                    ) : assignHref ? (
                      <Link
                        href={assignHref}
                        className="text-attention relative z-10 font-medium hover:underline"
                      >
                        Assign
                      </Link>
                    ) : (
                      <span className="text-attention font-medium">
                        Unassigned
                      </span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground text-xs">Roster</dt>
                  <dd className="text-sm tabular-nums">
                    {plural(c.students, "student", "students")}
                  </dd>
                </dl>
                {c.attention.length > 0 && (
                  <p className="text-attention flex items-start gap-1.5 text-xs">
                    <span
                      aria-hidden
                      className="bg-attention mt-1 size-1.5 shrink-0 rounded-full"
                    />
                    {c.attention.join(" · ")}
                  </p>
                )}
                {!c.isActive && (
                  <Badge variant="secondary" className="w-fit">
                    inactive
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
