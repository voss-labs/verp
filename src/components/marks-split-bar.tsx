import { cn } from "@/lib/utils"

export type MarksSegment = {
  label: string
  value: number
}

export type MarksSplitBarProps = {
  segments: MarksSegment[]
  total?: number
  compact?: boolean
  className?: string
}

const SHADES = [
  "bg-blue/25",
  "bg-blue/45",
  "bg-blue/65",
  "bg-blue/85",
  "bg-blue",
]

function shadeFor(index: number, count: number) {
  if (count <= 1) return SHADES[SHADES.length - 1]
  return SHADES[Math.round((index * (SHADES.length - 1)) / (count - 1))]
}

export function MarksSplitBar({
  segments,
  total,
  compact = false,
  className,
}: MarksSplitBarProps) {
  const sum = segments.reduce((acc, s) => acc + s.value, 0)
  const scale = total && total > 0 ? total : sum
  const legend = segments.map((s) => `${s.label} ${s.value}`).join(" / ")

  return (
    <div
      data-slot="marks-split-bar"
      className={cn("flex flex-col gap-1.5", className)}
    >
      <div
        role="img"
        aria-label={legend}
        className={cn(
          "bg-muted flex w-full gap-px overflow-hidden rounded-sm",
          compact ? "h-1.5" : "h-2"
        )}
      >
        {scale > 0 &&
          segments.map((segment, index) => (
            <div
              key={segment.label}
              className={cn("h-full", shadeFor(index, segments.length))}
              style={{ flexBasis: `${(segment.value / scale) * 100}%` }}
            />
          ))}
      </div>
      {!compact && segments.length > 0 && (
        <p className="identifier text-muted-foreground">{legend}</p>
      )}
    </div>
  )
}
