"use client"

import { useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { CAPABILITY_CATALOG, ROLE_DEFAULTS, type Capability } from "@/lib/rbac"
import { setRoleCapabilityAction } from "../actions"

type ToggleTier = "hod" | "faculty" | "student"
type Override = { tier: string; capability: string; effect: "grant" | "deny" }

const TIERS: { key: ToggleTier; label: string }[] = [
  { key: "hod", label: "HOD" },
  { key: "faculty", label: "Faculty" },
  { key: "student", label: "Student" },
]

export function RolesClient({ overrides }: { overrides: Override[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

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

  function toggle(tier: ToggleTier, capability: Capability, enabled: boolean) {
    start(async () => {
      const res = await setRoleCapabilityAction({ tier, capability, enabled })
      if (res.error) {
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  // Group the catalogue for section headers, preserving order.
  const groups = useMemo(() => {
    const out: { group: string; caps: typeof CAPABILITY_CATALOG }[] = []
    for (const entry of CAPABILITY_CATALOG) {
      let g = out.find((x) => x.group === entry.group)
      if (!g) {
        g = { group: entry.group, caps: [] }
        out.push(g)
      }
      g.caps.push(entry)
    }
    return out
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Capabilities default per tier (in code). Toggle to grant or revoke over
        the default — a dot marks a cell that differs from its baseline.
        Super-admin always has everything and is never listed.
      </p>

      <div className="border-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="p-3 text-left text-xs font-medium">Capability</th>
              {TIERS.map((t) => (
                <th
                  key={t.key}
                  className="w-24 p-3 text-center text-xs font-medium"
                >
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {groups.map((g) => (
              <GroupRows
                key={g.group}
                group={g.group}
                caps={g.caps}
                effective={effective}
                overridden={overridden}
                pending={pending}
                onToggle={toggle}
              />
            ))}
          </tbody>
        </table>
      </div>
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
