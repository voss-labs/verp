"use client"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type DialogFact = {
  label: string
  value: React.ReactNode
  mono?: boolean
}

/** Inspect one roster record over the table it was opened from, without losing the filters behind it. */
export function RecordDialog({
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
  facts?: DialogFact[]
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 gap-1 px-4 pt-4 pr-12">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {subtitle && (
            <DialogDescription className="text-xs">
              {subtitle}
            </DialogDescription>
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
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-4 py-4">
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
          <div className="border-border shrink-0 border-t px-4 py-3">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** A titled block inside the record dialog — assignments, activity, related records. */
export function DialogSection({
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
