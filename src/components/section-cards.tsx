"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  UsersIcon,
  BookOpenIcon,
  CalendarCheckIcon,
  WalletIcon,
} from "lucide-react"

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        label="Total Students"
        value="3,456"
        trend="+8.2%"
        trendUp
        detail="New admissions this semester"
        sub="Across all departments"
        icon={<UsersIcon className="size-4" />}
        iconBg="bg-blue/10 text-blue"
      />
      <StatCard
        label="Faculty Members"
        value="248"
        trend="+3.1%"
        trendUp
        detail="12 new hires this year"
        sub="Full-time and adjunct"
        icon={<BookOpenIcon className="size-4" />}
        iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        label="Attendance Rate"
        value="87.3%"
        trend="-2.4%"
        trendUp={false}
        detail="Slight dip this month"
        sub="Needs department review"
        icon={<CalendarCheckIcon className="size-4" />}
        iconBg="bg-amber-500/10 text-amber-600 dark:text-amber-400"
      />
      <StatCard
        label="Fee Collection"
        value="92.1%"
        trend="+5.3%"
        trendUp
        detail="Above target collection"
        sub="Current semester"
        icon={<WalletIcon className="size-4" />}
        iconBg="bg-violet-500/10 text-violet-600 dark:text-violet-400"
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  trend,
  trendUp,
  detail,
  sub,
  icon,
  iconBg,
}: {
  label: string
  value: string
  trend: string
  trendUp: boolean
  detail: string
  sub: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div
            className={`flex size-8 items-center justify-center rounded-lg ${iconBg}`}
          >
            {icon}
          </div>
          <CardDescription className="font-medium">{label}</CardDescription>
        </div>
        <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <Badge
            variant="outline"
            className={
              trendUp
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-destructive border-destructive/20 bg-destructive/10"
            }
          >
            {trendUp ? <TrendingUpIcon /> : <TrendingDownIcon />}
            {trend}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">{detail}</div>
        <div className="text-muted-foreground text-xs">{sub}</div>
      </CardFooter>
    </Card>
  )
}
