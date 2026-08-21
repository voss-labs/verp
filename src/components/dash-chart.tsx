"use client"

import { ChartColumnIcon, ChartLineIcon } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"

import { EmptyState } from "@/components/empty-state"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

// One series, one hue. The panel title names what is plotted, so a legend would
// repeat it, and a second colour would say these marks mean different things.
const SHELL = "aspect-auto h-40 w-full"
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 }

export type TrendPoint = { date: string; value: number }

export type TrendLineProps = {
  data: TrendPoint[]
  yLabel: string
  emptyLabel?: string
}

export type ComparePoint = { label: string; value: number; total?: number }

export type CompareBarsProps = {
  data: ComparePoint[]
  valueLabel?: string
  emptyLabel?: string
}

// Both charts format their own tooltip row: the shared one drops a falsy value,
// and a day nobody attended is the reading that matters most.
function Readout({
  label,
  value,
  total,
}: {
  label: string
  value: string
  total?: number
}) {
  return (
    <span className="text-muted-foreground flex flex-1 justify-between gap-3">
      {label}
      <span className="text-foreground font-mono font-medium tabular-nums">
        {value}
        {total === undefined ? "" : ` of ${total}`}
      </span>
    </span>
  )
}

export function TrendLine({
  data,
  yLabel,
  emptyLabel = "Nothing recorded yet",
}: TrendLineProps) {
  if (data.length === 0) {
    return (
      <EmptyState icon={ChartLineIcon} title={emptyLabel} variant="dashed" />
    )
  }

  const config = {
    value: { label: yLabel, color: "var(--blue)" },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className={SHELL}>
      <LineChart accessibilityLayer data={data} margin={MARGIN}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          width={32}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <Readout label={yLabel} value={String(value)} />
              )}
            />
          }
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  )
}

export function CompareBars({
  data,
  valueLabel = "Count",
  emptyLabel = "Nothing to compare yet",
}: CompareBarsProps) {
  if (data.length === 0) {
    return (
      <EmptyState icon={ChartColumnIcon} title={emptyLabel} variant="dashed" />
    )
  }

  const config = {
    value: { label: valueLabel, color: "var(--blue)" },
  } satisfies ChartConfig

  // Every bar is read against the largest whole, not against the largest bar:
  // scaling to the tallest column makes the class furthest behind look full.
  const ceiling = Math.max(...data.map((d) => d.total ?? d.value))

  return (
    <ChartContainer config={config} className={SHELL}>
      <BarChart accessibilityLayer data={data} margin={MARGIN} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          width={32}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          allowDecimals={false}
          domain={[0, ceiling > 0 ? ceiling : "auto"]}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value, _name, item) => (
                <Readout
                  label={valueLabel}
                  value={String(value)}
                  total={(item.payload as ComparePoint | undefined)?.total}
                />
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[2, 2, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ChartContainer>
  )
}
