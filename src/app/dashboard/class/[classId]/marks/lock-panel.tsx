"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type LockComponent = "isa" | "mse" | "ese"

export const LOCK_LABEL: Record<LockComponent, string> = {
  isa: "ISA",
  mse: "MSE",
  ese: "ESE",
}

export function LockPanel({
  hasMse,
  isLocked,
  mayUnlock,
  pending,
  onToggle,
}: {
  hasMse: boolean
  isLocked: (c: LockComponent) => boolean
  mayUnlock: (c: LockComponent) => boolean
  pending: boolean
  onToggle: (c: LockComponent, next: boolean) => void
}) {
  const components: LockComponent[] = hasMse
    ? ["isa", "mse", "ese"]
    : ["isa", "ese"]
  return (
    <div className="border-border flex flex-wrap items-center gap-2 rounded border px-3 py-2">
      <span className="text-muted-foreground mr-1 text-xs font-medium">
        Components
      </span>
      {components.map((c) => {
        const locked = isLocked(c)
        return (
          <div key={c} className="flex items-center gap-1.5">
            <Badge variant={locked ? "secondary" : "outline"}>
              {LOCK_LABEL[c]}
              {locked ? " · locked" : ""}
            </Badge>
            {locked ? (
              mayUnlock(c) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={pending}
                  onClick={() => onToggle(c, false)}
                >
                  Unlock
                </Button>
              ) : null
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={pending}
                onClick={() => onToggle(c, true)}
              >
                Lock
              </Button>
            )}
          </div>
        )
      })}
      {components.some((c) => isLocked(c) && !mayUnlock(c)) && (
        <span className="text-muted-foreground ml-auto text-xs">
          Ask the class coordinator to reopen a component somebody else locked.
        </span>
      )}
    </div>
  )
}
