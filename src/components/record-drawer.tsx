"use client"

import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/**
 * The shared record drawer (spec 5.2).
 *
 * Inspecting a person or a course used to mean leaving the table, losing the
 * filters and the scroll position, and navigating back. A drawer keeps the list
 * behind it, so comparing two records is two clicks rather than four page loads.
 *
 * Deliberately presentational: it takes facts, badges and actions rather than
 * fetching. A drawer that queried on open would make every table page depend on
 * a client data path, which is what the server-scoped queries exist to avoid.
 */

export type DrawerFact = {
  label: string
  value: React.ReactNode
  mono?: boolean
}

export function RecordDrawer({
  open,
  onClose,
  title,
  subtitle,
  badges,
  facts,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  badges?: { label: string; tone?: "default" | "warn" | "critical" }[]
  facts?: DrawerFact[]
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="gap-1">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {subtitle && (
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          )}
          {badges && badges.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <Badge
                  key={b.label}
                  variant={b.tone === "critical" ? "destructive" : "outline"}
                  className={b.tone === "warn" ? "text-attention" : undefined}
                >
                  {b.label}
                </Badge>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-4">
          {facts && facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-muted-foreground text-xs">{f.label}</dt>
                  <dd
                    className={
                      f.mono
                        ? "identifier mt-0.5"
                        : "mt-0.5 text-sm font-medium"
                    }
                  >
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {children}
        </div>

        {footer && (
          <div className="border-border mt-auto border-t px-4 py-3">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** A titled block inside a drawer — assignments, activity, related records. */
export function DrawerSection({
  title,
  empty,
  children,
}: {
  title: string
  empty?: string
  children?: React.ReactNode
}) {
  const isEmpty =
    !children || (Array.isArray(children) && children.length === 0)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold">{title}</h3>
      {isEmpty ? (
        <p className="text-muted-foreground text-xs">
          {empty ?? "Nothing yet."}
        </p>
      ) : (
        children
      )}
    </section>
  )
}
