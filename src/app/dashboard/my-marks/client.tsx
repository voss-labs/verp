"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { computeMarks, type CgpaResult, type CourseInfo } from "@/lib/sgpi"

type Subject = {
  code: string
  name: string
  credits: number
  marks: {
    isa: number | null
    mse1: number | null
    mse2: number | null
    ese: number | null
  }
  course: CourseInfo
}
type Semester = { semester: number; subjects: Subject[] }

export function MyMarksClient({
  cgpa,
  semesters,
}: {
  cgpa: CgpaResult
  semesters: Semester[]
}) {
  if (semesters.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No marks recorded yet. They appear here once your teachers enter them.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="CGPA"
          // A fail anywhere makes an aggregate misleading rather than merely
          // low, so it is withheld instead of quietly averaged away.
          value={cgpa.hasFail ? "—" : (cgpa.cgpa?.toFixed(2) ?? "—")}
          hint={
            cgpa.hasFail
              ? "pending a re-attempt"
              : `${cgpa.totalCredits} credits`
          }
        />
        <Stat
          label="Semesters"
          value={String(cgpa.completedSemesters)}
          hint="completed"
        />
        <Stat
          label="Credit points"
          value={String(cgpa.totalCreditPoints)}
          hint="earned"
        />
      </div>

      {semesters.map((sem) => {
        const result = cgpa.perSemester.find((p) => p.semester === sem.semester)
        return (
          <Card key={sem.semester}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Semester {sem.semester}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">SGPI</span>
                <Badge
                  variant={result?.sgpi.hasFail ? "destructive" : "outline"}
                >
                  {result?.sgpi.hasFail
                    ? "Fail"
                    : (result?.sgpi.sgpi?.toFixed(2) ?? "—")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground text-xs">
                    <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:text-left [&>th]:font-medium">
                      <th>Code</th>
                      <th>Subject</th>
                      <th className="w-16">Credits</th>
                      <th className="w-16">Total</th>
                      <th className="w-14">%</th>
                      <th className="w-16">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {sem.subjects.map((s) => {
                      const c = computeMarks(s.marks, s.course)
                      return (
                        <tr key={s.code} className="[&>td]:px-2 [&>td]:py-1.5">
                          <td className="font-mono text-xs">{s.code}</td>
                          <td>{s.name}</td>
                          <td className="tabular-nums">{s.credits}</td>
                          <td className="tabular-nums">
                            {c.percentage == null
                              ? "—"
                              : `${c.total}/${s.course.maxTotal}`}
                          </td>
                          <td className="text-muted-foreground tabular-nums">
                            {c.percentage ?? "—"}
                          </td>
                          <td>
                            {c.gradePoint == null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : c.gradePoint === "Fail" ? (
                              <Badge variant="destructive">Fail</Badge>
                            ) : (
                              <Badge variant="outline">{c.gradePoint}</Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="border-border rounded border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  )
}
