"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * The class workspace's tab strip (spec 6.16).
 *
 * These were five outline buttons in a row that looked like actions rather than
 * places, so nothing told you where you already were. Real routes rather than
 * client tab state, because each surface loads its own scoped data on the
 * server and a shared tab component would have to fetch all of it up front.
 *
 * A tab the viewer cannot open is omitted, not disabled: they have no way to
 * gain the capability from here, so showing it is only a locked door.
 */
export type ClassTab = { label: string; href: string; badge?: number }

export function ClassTabs({ tabs }: { tabs: ClassTab[] }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Class sections"
      className="border-border -mb-px flex gap-1 overflow-x-auto border-b"
    >
      {tabs.map((t) => {
        // The overview is the class root, so it must match exactly or every
        // child route would light it up too.
        const active =
          pathname === t.href ||
          (t.href.split("/").length > 4 && pathname.startsWith(t.href))
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent"
            )}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="bg-attention text-attention-foreground rounded-full px-1.5 py-0.5 text-[0.6875rem] leading-none tabular-nums">
                {t.badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
