"use client"

import { useId } from "react"
import { ChartColumnIcon, ChartLineIcon } from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

const PERCENT_DOMAIN: [number, number] = [0, 100]
const PERCENT_TICKS = [0, 25, 50, 75, 100]
const ALL_TICKS_UP_TO = 14

export type TrendPoint = { date: string; value: number }

export type TrendLineProps = {
  data: TrendPoint[]
  yLabel: string
  emptyLabel?: string
  percent?: boolean
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
  percent = true,
}: TrendLineProps) {
  const fillId = `trend-fill-${useId().replace(/[^a-zA-Z0-9]/g, "")}`

  if (data.length === 0) {
    return (
      <EmptyState icon={ChartLineIcon} title={emptyLabel} variant="dashed" />
    )
  }

  const config = {
    value: { label: yLabel, color: "var(--blue)" },
  } satisfies ChartConfig

  const everyTick = data.length <= ALL_TICKS_UP_TO

  return (
    <ChartContainer config={config} className={SHELL}>
      <AreaChart accessibilityLayer data={data} margin={MARGIN}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-value)"
              stopOpacity={0.25}
            />
            <stop
              offset="100%"
              stopColor="var(--color-value)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={everyTick ? 0 : "preserveStartEnd"}
          minTickGap={everyTick ? 0 : 24}
        />
        <YAxis
          width={32}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          allowDecimals={false}
          domain={percent ? PERCENT_DOMAIN : undefined}
          ticks={percent ? PERCENT_TICKS : undefined}
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
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.75}
          strokeLinecap="round"
          fill={`url(#${fillId})`}
          fillOpacity={1}
          dot={{
            r: 3,
            fill: "var(--color-value)",
            stroke: "var(--card)",
            strokeWidth: 1.5,
          }}
          activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 1.5 }}
        />
      </AreaChart>
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
