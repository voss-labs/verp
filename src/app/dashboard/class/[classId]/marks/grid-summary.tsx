import { MarksSplitBar } from "@/components/marks-split-bar"
import type { Bound } from "@/lib/marks-integrity"
import type { CourseInfo, MarksInput } from "@/lib/sgpi"

function summarize(values: number[]) {
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    mean: Math.round((sum / values.length) * 10) / 10,
    low: Math.min(...values),
    high: Math.max(...values),
  }
}

export function DistributionSummary({
  rows,
  columns,
  course,
}: {
  rows: MarksInput[]
  columns: Bound[]
  course: CourseInfo
}) {
  const scheme = [
    { label: "ISA", value: course.maxIsa },
    { label: "MSE", value: course.maxMse },
    { label: "ESE", value: course.maxEse },
  ].filter((s) => s.value > 0)

  return (
    <div className="border-border flex flex-wrap items-start gap-x-6 gap-y-3 rounded border px-3 py-2">
      <span className="text-muted-foreground py-0.5 text-xs font-medium">
        Entered
      </span>
      {columns.map((c) => {
        const values = rows
          .map((r) => r[c.field])
          .filter((v): v is number => v != null)
        const stat = summarize(values)
        return (
          <div key={c.field} className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{c.label}</span>
            <span className="identifier">
              {values.length}/{rows.length}
            </span>
            <span className="identifier text-muted-foreground">
              {stat ? `mean ${stat.mean} · ${stat.low}–${stat.high}` : "—"}
            </span>
          </div>
        )
      })}
      <div className="ml-auto flex w-44 flex-col gap-1">
        <span className="text-muted-foreground text-xs">Scheme</span>
        <MarksSplitBar segments={scheme} total={course.maxTotal} />
      </div>
    </div>
  )
}
