"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { SearchIcon } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { CAPABILITY_CATALOG, ROLE_DEFAULTS, type Capability } from "@/lib/rbac"
import { Input } from "@/components/ui/input"
import { ConfirmAction } from "@/components/confirm-action"
import { EmptyState } from "@/components/empty-state"
import { setRoleCapabilityAction } from "../actions"

type ToggleTier = "hod" | "faculty" | "student"
type Override = { tier: string; capability: string; effect: "grant" | "deny" }

const TIERS: { key: ToggleTier; label: string; one: string; many: string }[] = [
  { key: "hod", label: "HOD", one: "HOD", many: "HODs" },
  {
    key: "faculty",
    label: "Faculty",
    one: "faculty member",
    many: "faculty members",
  },
  { key: "student", label: "Student", one: "student", many: "students" },
]

export function RolesClient({
  overrides,
  headcount,
}: {
  overrides: Override[]
  headcount: Record<string, number>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [query, setQuery] = useState("")

  // (tier, capability) -> effect, for quick lookup.
  const overrideMap = useMemo(() => {
    const m = new Map<string, "grant" | "deny">()
    for (const o of overrides) m.set(`${o.tier}:${o.capability}`, o.effect)
    return m
  }, [overrides])

  const isDefault = (tier: ToggleTier, cap: Capability) =>
    ROLE_DEFAULTS[tier].includes(cap)

  const effective = (tier: ToggleTier, cap: Capability) => {
    const ov = overrideMap.get(`${tier}:${cap}`)
    return ov ? ov === "grant" : isDefault(tier, cap)
  }

  const overridden = (tier: ToggleTier, cap: Capability) =>
    overrideMap.has(`${tier}:${cap}`)

  async function apply(
    tier: ToggleTier,
    capability: Capability,
    enabled: boolean
  ) {
    const res = await setRoleCapabilityAction({ tier, capability, enabled })
    if (res.error) {
      toast.error(res.error)
      return
    }
    start(() => router.refresh())
  }

  function grant(tier: ToggleTier, capability: Capability) {
    start(async () => {
      await apply(tier, capability, true)
    })
  }

  // Group the catalogue for section headers, preserving order. The search
  // matches the capability string as well as its label, because the string is
  // what appears in the code being reasoned about: somebody arriving from a
  // Forbidden error knows "marks:lock", not "Lock a marks component".
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: { group: string; caps: typeof CAPABILITY_CATALOG }[] = []
    for (const entry of CAPABILITY_CATALOG) {
      if (
        q &&
        !entry.capability.toLowerCase().includes(q) &&
        !entry.label.toLowerCase().includes(q) &&
        !entry.group.toLowerCase().includes(q)
      )
        continue
      let g = out.find((x) => x.group === entry.group)
      if (!g) {
        g = { group: entry.group, caps: [] }
        out.push(g)
      }
      g.caps.push(entry)
    }
    return out
  }, [query])

  const shown = groups.reduce((n, g) => n + g.caps.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Capabilities default per tier (in code). Toggle to grant or revoke
          over the default. Super-admin always has everything and is never
          listed.
        </p>
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="bg-blue size-1.5 shrink-0 rounded-full" />A dot marks
          a cell that differs from its coded default.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search capabilities, e.g. marks:lock"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {query && (
          <p className="text-muted-foreground text-xs tabular-nums">
            {shown} of {CAPABILITY_CATALOG.length} capabilities
          </p>
        )}
      </div>

      <div className="border-border max-h-[70vh] overflow-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          {/* The table is taller than the screen and the header carries the
              only thing that says which column is which tier — scrolling it
              away turns every switch into a guess. */}
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="bg-muted border-border sticky left-0 z-30 border-r p-3 text-left text-xs font-medium">
                Capability
              </th>
              {TIERS.map((t) => {
                const n = headcount[t.key] ?? 0
                return (
                  <th
                    key={t.key}
                    title={`${n} active ${n === 1 ? t.one : t.many} hold${n === 1 ? "s" : ""} this tier`}
                    className="bg-muted w-24 p-3 text-center text-xs font-medium"
                  >
                    <span className="block">{t.label}</span>
                    <span className="text-muted-foreground font-normal tabular-nums">
                      {n}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={1 + TIERS.length} className="p-0">
                  <EmptyState
                    icon={SearchIcon}
                    title={`No capability matches “${query}”`}
                    description="The search reads the label, the group, and the capability string."
                  />
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <GroupRows
                  key={g.group}
                  group={g.group}
                  caps={g.caps}
                  headcount={headcount}
                  effective={effective}
                  overridden={overridden}
                  pending={pending}
                  onGrant={grant}
                  onRevoke={(t, c) => apply(t, c, false)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GroupRows({
  group,
  caps,
  headcount,
  effective,
  overridden,
  pending,
  onGrant,
  onRevoke,
}: {
  group: string
  caps: typeof CAPABILITY_CATALOG
  headcount: Record<string, number>
  effective: (t: ToggleTier, c: Capability) => boolean
  overridden: (t: ToggleTier, c: Capability) => boolean
  pending: boolean
  onGrant: (t: ToggleTier, c: Capability) => void
  onRevoke: (t: ToggleTier, c: Capability) => Promise<void>
}) {
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={1 + TIERS.length} className="px-3 py-1.5">
          <span className="text-muted-foreground sticky left-3 inline-block text-xs font-medium">
            {group}
          </span>
        </td>
      </tr>
      {caps.map((c) => (
        <tr key={c.capability} className="group/row hover:bg-muted/20">
          <td className="bg-background group-hover/row:bg-muted/20 border-border sticky left-0 z-10 border-r p-3 transition-colors">
            <span>{c.label}</span>
            <span className="text-muted-foreground/60 ml-2 font-mono text-[10px]">
              {c.capability}
            </span>
          </td>
          {TIERS.map((t) => {
            const n = headcount[t.key] ?? 0
            const name = `${c.label} — ${t.label}`
            return (
              <td key={t.key} className="p-3 text-center">
                <div className="relative inline-flex items-center">
                  {effective(t.key, c.capability) ? (
                    <ConfirmAction
                      trigger={
                        <Switch checked disabled={pending} aria-label={name} />
                      }
                      disabled={pending}
                      title={`Revoke ${c.label} from ${t.label}?`}
                      description={
                        <>
                          <span className="text-foreground font-medium tabular-nums">
                            {n}
                          </span>{" "}
                          active {n === 1 ? t.one : t.many}{" "}
                          {n === 1 ? "loses" : "lose"}{" "}
                          <span className="identifier">{c.capability}</span> the
                          moment this is saved — everywhere, not only where you
                          were thinking of. The change is recorded in the audit
                          log against your account.
                        </>
                      }
                      confirmLabel="Revoke"
                      cancelLabel="Keep it"
                      onConfirm={() => onRevoke(t.key, c.capability)}
                    />
                  ) : (
                    <Switch
                      checked={false}
                      disabled={pending}
                      aria-label={name}
                      onCheckedChange={() => onGrant(t.key, c.capability)}
                    />
                  )}
                  {overridden(t.key, c.capability) && (
                    <>
                      <span
                        aria-hidden
                        className="bg-blue absolute -top-1 -right-1 size-1.5 rounded-full"
                      />
                      <span className="sr-only">Differs from the default</span>
                    </>
                  )}
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
