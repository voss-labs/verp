"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { BookOpenIcon, FlaskConicalIcon, FolderGit2Icon } from "lucide-react"

type OfferingItem = {
  id: string
  division: string | null
  course: {
    courseCode: string
    courseName: string
    courseType: string
    credits: number
    maxIsa: number
    maxMse: number
    maxEse: number
    maxTotal: number
  }
  faculty: { firstName: string; lastName: string } | null
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  theory: <BookOpenIcon className="size-3.5" />,
  practical: <FlaskConicalIcon className="size-3.5" />,
  project: <FolderGit2Icon className="size-3.5" />,
}

const TYPE_COLORS: Record<string, string> = {
  theory: "bg-muted text-muted-foreground border-border",
  practical: "bg-muted text-muted-foreground border-border",
  project: "bg-muted text-muted-foreground border-border",
}

export function MarksOverviewClient({
  offerings,
  semesterLabel,
}: {
  offerings: OfferingItem[]
  semesterLabel: string
}) {
  const theory = offerings.filter((o) => o.course.courseType === "theory")
  const practical = offerings.filter((o) => o.course.courseType === "practical")
  const project = offerings.filter((o) => o.course.courseType === "project")

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{semesterLabel}</p>
        <p className="text-muted-foreground text-sm">
          {offerings.length} course(s)
        </p>
      </div>

      {theory.length > 0 && (
        <Section title="Theory" count={theory.length} items={theory} />
      )}
      {practical.length > 0 && (
        <Section title="Practical" count={practical.length} items={practical} />
      )}
      {project.length > 0 && (
        <Section title="Project" count={project.length} items={project} />
      )}

      {offerings.length === 0 && (
        <div className="border-border flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="bg-muted mb-4 flex size-12 items-center justify-center rounded-full">
            <BookOpenIcon className="text-muted-foreground size-5" />
          </div>
          <p className="text-foreground text-sm font-medium">
            No course offerings found
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Create offerings first to manage marks.
          </p>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  items,
}: {
  title: string
  count: number
  items: OfferingItem[]
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          {title}
        </h2>
        <Badge variant="secondary" className="text-xs tabular-nums">
          {count}
        </Badge>
      </div>
      <div className="grid gap-3 @xl/main:grid-cols-2 @4xl/main:grid-cols-3">
        {items.map((o) => (
          <Link key={o.id} href={`/dashboard/marks/${o.id}`}>
            <Card className="group hover:border-blue/30 transition-all hover:shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-xs">
                    {o.course.courseCode}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    {o.division && (
                      <Badge variant="secondary" className="text-xs">
                        Div {o.division}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${TYPE_COLORS[o.course.courseType] ?? ""}`}
                    >
                      {TYPE_ICONS[o.course.courseType]}
                      {o.course.courseType}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="group-hover:text-blue mt-2 text-sm font-medium transition-colors">
                  {o.course.courseName}
                </CardTitle>
                <CardDescription>
                  {o.faculty
                    ? `${o.faculty.firstName} ${o.faculty.lastName}`
                    : "Unassigned"}
                  {" · "}
                  {o.course.credits} credit{o.course.credits !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground flex gap-3 text-xs">
                  <span className="bg-muted rounded px-1.5 py-0.5">
                    ISA: {o.course.maxIsa}
                  </span>
                  {o.course.maxMse > 0 && (
                    <span className="bg-muted rounded px-1.5 py-0.5">
                      MSE: {o.course.maxMse}
                    </span>
                  )}
                  <span className="bg-muted rounded px-1.5 py-0.5">
                    ESE: {o.course.maxEse}
                  </span>
                  <span className="bg-blue/8 text-blue rounded px-1.5 py-0.5 font-medium">
                    Total: {o.course.maxTotal}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
