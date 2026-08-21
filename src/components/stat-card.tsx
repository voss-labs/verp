import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type StatCardTone =
  | "default"
  | "success"
  | "attention"
  | "warning"
  | "destructive"

export type StatCardProps = {
  label: string
  value: ReactNode
  detail?: string
  tone?: StatCardTone
  href?: string
  className?: string
}

export type StatCardRowProps = {
  children: ReactNode
  className?: string
}

const VALUE_TONE: Record<StatCardTone, string> = {
  default: "text-foreground",
  success: "text-success",
  attention: "text-attention",
  warning: "text-warning",
  destructive: "text-destructive",
}

export function StatCard({
  label,
  value,
  detail,
  tone = "default",
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div
        className={cn(
          "mt-1.5 text-2xl leading-none font-semibold tracking-tight tabular-nums",
          VALUE_TONE[tone]
        )}
      >
        {value}
      </div>
      {detail && (
        <p className="text-muted-foreground mt-1.5 text-xs">{detail}</p>
      )}
    </>
  )

  const shell = cn(
    "bg-card text-card-foreground ring-foreground/10 block rounded-lg p-4 ring-1",
    href &&
      "hover:bg-muted/40 focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-2",
    className
  )

  if (href) {
    return (
      <Link href={href} data-slot="stat-card" className={shell}>
        {body}
      </Link>
    )
  }

  return (
    <div data-slot="stat-card" className={shell}>
      {body}
    </div>
  )
}

export function StatCardRow({ children, className }: StatCardRowProps) {
  return (
    <div
      data-slot="stat-card-row"
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  )
}
