import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  variant?: "plain" | "dashed"
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "plain",
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 px-6 py-8 text-center",
        variant === "dashed" && "border-border rounded-lg border border-dashed",
        className
      )}
    >
      <Icon className="text-muted-foreground size-5" strokeWidth={1.5} />
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-sm text-xs text-balance">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
