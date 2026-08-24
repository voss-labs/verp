import { cn } from "@/lib/utils"

export function BatchChip({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "identifier bg-muted text-muted-foreground inline-block rounded px-1.5 align-baseline",
        className
      )}
    >
      <span className="sr-only">Batch </span>
      {name}
    </span>
  )
}
