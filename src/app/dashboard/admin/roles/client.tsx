"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { CAPABILITY_CATALOG, ROLE_DEFAULTS, type Capability } from "@/lib/rbac"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { setRoleCapabilityAction } from "../actions"

type ToggleTier = "hod" | "faculty" | "student"
type Override = { tier: string; capability: string; effect: "grant" | "deny" }

const TIERS: { key: ToggleTier; label: string }[] = [
  { key: "hod", label: "HOD" },
  { key: "faculty", label: "Faculty" },
  { key: "student", label: "Student" },
]

type PendingChange = {
  tier: ToggleTier
  tierLabel: string
  capability: Capability
  capLabel: string
  enabled: boolean
  affected: number
}

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
  const [confirming, setConfirming] = useState<PendingChange | null>(null)

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

  function apply(tier: ToggleTier, capability: Capability, enabled: boolean) {
    start(async () => {
      const res = await setRoleCapabilityAction({ tier, capability, enabled })
      if (res.error) {
        toast.error(res.error)
        return
      }
      setConfirming(null)
      router.refresh()
    })
  }

  // Taking a capability away is the direction that breaks someone's day
  // mid-semester, so it stops to say whose. Granting is additive and goes
  // straight through: nobody loses work because a switch turned on.
  function toggle(tier: ToggleTier, capability: Capability, enabled: boolean) {
    if (enabled) {
      apply(tier, capability, true)
      return
    }
    setConfirming({
      tier,
      tierLabel: TIERS.find((t) => t.key === tier)!.label,
      capability,
      capLabel:
        CAPABILITY_CATALOG.find((c) => c.capability === capability)?.label ??
        capability,
      enabled: false,
      affected: headcount[tier] ?? 0,
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
      <p className="text-muted-foreground text-sm leading-relaxed">
        Capabilities default per tier (in code). Toggle to grant or revoke over
        the default — a dot marks a cell that differs from its baseline.
        Super-admin always has everything and is never listed.
      </p>

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
          <thead className="bg-muted/60 sticky top-0 z-10">
            <tr>
              <th className="p-3 text-left text-xs font-medium">Capability</th>
              {TIERS.map((t) => (
                <th
                  key={t.key}
                  className="w-24 p-3 text-center text-xs font-medium"
                >
                  <span className="block">{t.label}</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    {headcount[t.key] ?? 0}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {groups.length === 0 ? (
              <tr>
                <td
                  colSpan={1 + TIERS.length}
                  className="text-muted-foreground p-6 text-center text-sm"
                >
                  No capability matches “{query}”.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <GroupRows
                  key={g.group}
                  group={g.group}
                  caps={g.caps}
                  effective={effective}
                  overridden={overridden}
                  pending={pending}
                  onToggle={toggle}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revoke {confirming?.capLabel} from {confirming?.tierLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-foreground font-medium tabular-nums">
                {confirming?.affected}
              </span>{" "}
              active {confirming?.tierLabel.toLowerCase()} account
              {confirming?.affected === 1 ? "" : "s"} lose{" "}
              <span className="identifier">{confirming?.capability}</span> the
              moment this is saved. Anyone mid-task is refused on their next
              action.
            </AlertDialogDescription>
            {/* Outside the description, which renders a paragraph of its own —
                a nested <p> is invalid and hydrates as a mismatch. */}
            <p className="text-muted-foreground text-xs">
              Scope still applies on top of this: revoking here removes the
              action everywhere, not only where you were thinking of. The change
              is recorded in the audit log against your account.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                confirming &&
                apply(confirming.tier, confirming.capability, false)
              }
            >
              {pending ? "Revoking…" : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function GroupRows({
  group,
  caps,
  effective,
  overridden,
  pending,
  onToggle,
}: {
  group: string
  caps: typeof CAPABILITY_CATALOG
  effective: (t: ToggleTier, c: Capability) => boolean
  overridden: (t: ToggleTier, c: Capability) => boolean
  pending: boolean
  onToggle: (t: ToggleTier, c: Capability, v: boolean) => void
}) {
  return (
    <>
      <tr className="bg-muted/30">
        <td
          colSpan={1 + TIERS.length}
          className="text-muted-foreground px-3 py-1.5 text-xs font-medium"
        >
          {group}
        </td>
      </tr>
      {caps.map((c) => (
        <tr key={c.capability} className="hover:bg-muted/20">
          <td className="p-3">
            <span>{c.label}</span>
            <span className="text-muted-foreground/60 ml-2 font-mono text-[10px]">
              {c.capability}
            </span>
          </td>
          {TIERS.map((t) => (
            <td key={t.key} className="p-3 text-center">
              <div className="relative inline-flex items-center">
                <Switch
                  checked={effective(t.key, c.capability)}
                  disabled={pending}
                  onCheckedChange={(v) => onToggle(t.key, c.capability, v)}
                />
                {overridden(t.key, c.capability) && (
                  <span className="bg-blue absolute -top-1 -right-1 size-1.5 rounded-full" />
                )}
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
