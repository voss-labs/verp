"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Department workspace sections (spec 6.9).
 *
 * The department page had grown into one column holding leadership, classes,
 * faculty and the unplaced-student list at once — on a real department that is
 * a very long scroll where the thing you came for is never in view.
 *
 * These are query-string sections rather than routes: every section reads from
 * the same scoped queries the page already runs, so splitting them into routes
 * would mean repeating those reads per section for no gain.
 */
export type DeptSection = { key: string; label: string; badge?: number }

export function DeptTabs({
  sections,
  code,
}: {
  sections: DeptSection[]
  code: string
}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get("tab") ?? sections[0]?.key

  return (
    <nav
      aria-label="Department sections"
      className="border-border -mb-px flex gap-1 overflow-x-auto border-b"
    >
      {sections.map((s) => {
        const active = current === s.key
        const href =
          s.key === sections[0]?.key
            ? `/dashboard/dept/${code}`
            : `${pathname}?tab=${s.key}`
        return (
          <Link
            key={s.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {s.label}
            {s.badge != null && s.badge > 0 && (
              <span className="bg-attention text-attention-foreground rounded-full px-1.5 py-0.5 text-[0.6875rem] leading-none tabular-nums">
                {s.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
