import Link from "next/link"
import {
  CircleIcon,
  ClockIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type AttentionSeverity = "blocking" | "overdue" | "open"

export type AttentionScope = {
  label: string
  href?: string
}

export type AttentionCardProps = {
  severity: AttentionSeverity
  title: string
  description?: string
  scopes?: AttentionScope[]
  href?: string
  className?: string
}

export type AttentionGroupProps = {
  heading: string
  items: AttentionCardProps[]
  count?: number
  className?: string
}

const SEVERITY: Record<
  AttentionSeverity,
  { label: string; icon: LucideIcon; bar: string; chip: string }
> = {
  blocking: {
    label: "Blocking",
    icon: TriangleAlertIcon,
    bar: "border-l-destructive",
    chip: "bg-destructive/10 text-destructive",
  },
  overdue: {
    label: "Overdue",
    icon: ClockIcon,
    bar: "border-l-attention",
    chip: "bg-attention/10 text-attention",
  },
  open: {
    label: "Open",
    icon: CircleIcon,
    bar: "border-l-border",
    chip: "bg-muted text-muted-foreground",
  },
}

export function AttentionCard({
  severity,
  title,
  description,
  scopes,
  href,
  className,
}: AttentionCardProps) {
  const tone = SEVERITY[severity]
  const Icon = tone.icon

  return (
    <div
      data-slot="attention-card"
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 relative flex items-start gap-3 rounded-lg border-l-2 p-3 ring-1",
        tone.bar,
        href && "hover:bg-muted/40 transition-colors",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            className="focus-visible:after:ring-ring/50 text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2"
          >
            {title}
          </Link>
        ) : (
          <p className="text-sm font-medium">{title}</p>
        )}
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
        {scopes && scopes.length > 0 && (
          <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1">
            {scopes.map((scope) =>
              scope.href ? (
                <Badge
                  key={scope.label}
                  variant="outline"
                  className="identifier"
                  render={<Link href={scope.href} />}
                >
                  {scope.label}
                </Badge>
              ) : (
                <Badge
                  key={scope.label}
                  variant="outline"
                  className="identifier"
                >
                  {scope.label}
                </Badge>
              )
            )}
          </div>
        )}
      </div>
      <Badge variant="secondary" className={cn("shrink-0", tone.chip)}>
        <Icon data-icon="inline-start" />
        {tone.label}
      </Badge>
    </div>
  )
}

export function AttentionGroup({
  heading,
  items,
  count,
  className,
}: AttentionGroupProps) {
  return (
    <section
      data-slot="attention-group"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {count ?? items.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <AttentionCard key={`${item.title}-${index}`} {...item} />
        ))}
      </div>
    </section>
  )
}
