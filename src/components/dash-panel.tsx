import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowUpRightIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DashPanelProps = {
  title: string
  description?: string
  href?: string
  hrefLabel?: string
  className?: string
  children: ReactNode
}

export type DashGridProps = {
  children: ReactNode
  className?: string
}

export function DashPanel({
  title,
  description,
  href,
  hrefLabel = "Open",
  className,
  children,
}: DashPanelProps) {
  return (
    <Card size="sm" data-slot="dash-panel" className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {description}
            </p>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex shrink-0 items-center gap-1 rounded text-xs transition-colors outline-none focus-visible:ring-2"
          >
            {hrefLabel}
            <ArrowUpRightIcon className="size-3.5" strokeWidth={1.75} />
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/**
 * Twelve columns from `lg` up, one below it. Children carry their own span
 * (`lg:col-span-8`) so a panel decides its own width without the grid knowing
 * what is in it.
 */
export function DashGrid({ children, className }: DashGridProps) {
  return (
    <div
      data-slot="dash-grid"
      className={cn("grid grid-cols-1 gap-4 lg:grid-cols-12", className)}
    >
      {children}
    </div>
  )
}
