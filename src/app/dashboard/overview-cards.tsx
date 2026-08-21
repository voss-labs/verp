import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  buttonVariants,
  type ButtonVariants,
} from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"

/**
 * The overview's vocabulary.
 *
 * Every tile answers "what needs me", so each carries a count, what it means,
 * and a link to the exact filtered workspace that resolves it. A number with no
 * action behind it was what the old dashboard offered, and nobody could use it.
 */

export function Attention({
  count,
  label,
  href,
  tone = "attention",
}: {
  count: number
  label: string
  href: string
  tone?: "attention" | "critical" | "neutral"
}) {
  // Colour never carries the meaning alone — the count and the label do.
  const toneClass =
    count === 0
      ? "text-muted-foreground"
      : tone === "critical"
        ? "text-destructive"
        : tone === "attention"
          ? "text-amber-600"
          : "text-foreground"
  return (
    <Link
      href={href}
      className="border-border hover:bg-muted/50 flex items-center justify-between gap-3 rounded border px-3 py-2 transition-colors"
    >
      <span className="text-sm">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>
        {count}
      </span>
    </Link>
  )
}

export function WorkCard({
  title,
  subtitle,
  href,
  action,
  children,
}: {
  title: React.ReactNode
  subtitle?: string
  href?: string
  action?: {
    label: string
    href: string
    variant?: ButtonVariants["variant"]
  }
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">
            {href ? (
              <Link href={href} className="hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </CardTitle>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className={buttonVariants({
              variant: action.variant ?? "outline",
              size: "sm",
            })}
          >
            {action.label}
          </Link>
        )}
      </CardHeader>
      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

/** "63 of 89 marked" — progress a person can act on, not a percentage alone. */
export function Completion({
  done,
  total,
  noun,
}: {
  done: number
  total: number
  noun: string
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {done} of {total} {noun}
        </span>
        {total > 0 && done === total ? (
          <Badge variant="outline">Complete</Badge>
        ) : (
          <span className="text-muted-foreground tabular-nums">{pct}%</span>
        )}
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  )
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}
