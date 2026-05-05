"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  computeMarks,
  computeSgpi,
  type MarksInput,
  type CourseInfo,
} from "@/lib/sgpi"

type CourseMarks = {
  courseCode: string
  courseName: string
  courseType: string
  credits: number
  maxIsa: number
  maxMse: number
  maxEse: number
  maxTotal: number
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
}

type SemesterData = {
  semesterId: number
  semesterNumber: number
  academicYear: string
  courses: CourseMarks[]
}

export function MyMarksClient({
  studentName,
  rollNumber,
  semesters,
}: {
  studentName: string
  rollNumber: string
  semesters: SemesterData[]
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{studentName}</span>
        <Badge variant="outline" className="font-mono text-xs">
          {rollNumber}
        </Badge>
      </div>

      {semesters.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No marks recorded yet.
          </p>
        </div>
      )}

      {semesters.map((sem) => (
        <SemesterCard key={sem.semesterId} semester={sem} />
      ))}
    </div>
  )
}

function SemesterCard({ semester }: { semester: SemesterData }) {
  const entries = semester.courses.map((c) => ({
    marks: { isa: c.isa, mse1: c.mse1, mse2: c.mse2, ese: c.ese } as MarksInput,
    course: {
      courseType: c.courseType,
      credits: c.credits,
      maxIsa: c.maxIsa,
      maxMse: c.maxMse,
      maxEse: c.maxEse,
      maxTotal: c.maxTotal,
    } as CourseInfo,
  }))
  const sgpi = computeSgpi(entries)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Semester {semester.semesterNumber}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({semester.academicYear})
            </span>
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            {sgpi.hasFail && (
              <Badge
                variant="outline"
                className="text-destructive border-destructive/20 bg-destructive/10 text-xs"
              >
                Has Fail
              </Badge>
            )}
            <div className="bg-muted/50 flex items-center gap-1.5 rounded-lg border px-3 py-1.5">
              <span className="text-muted-foreground text-xs">SGPI</span>
              <span className="text-blue font-bold tabular-nums">
                {sgpi.sgpi ?? "-"}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-center">Cr</TableHead>
                <TableHead className="text-center">ISA</TableHead>
                <TableHead className="text-center">MSE</TableHead>
                <TableHead className="text-center">ESE</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-center">GP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semester.courses.map((c) => {
                const courseInfo: CourseInfo = {
                  courseType: c.courseType,
                  credits: c.credits,
                  maxIsa: c.maxIsa,
                  maxMse: c.maxMse,
                  maxEse: c.maxEse,
                  maxTotal: c.maxTotal,
                }
                const computed = computeMarks(
                  { isa: c.isa, mse1: c.mse1, mse2: c.mse2, ese: c.ese },
                  courseInfo
                )
                return (
                  <TableRow key={c.courseCode}>
                    <TableCell className="font-mono text-xs">
                      {c.courseCode}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {c.courseName}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                      >
                        {c.courseType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {c.credits}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {c.isa ?? "-"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {computed.finalMse ?? "-"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {c.ese ?? "-"}
                    </TableCell>
                    <TableCell className="text-center font-semibold tabular-nums">
                      {computed.percentage != null ? computed.total : "-"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {computed.percentage ?? "-"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {computed.gradePoint === "Fail" ? (
                        <span className="text-destructive font-medium">
                          Fail
                        </span>
                      ) : (
                        (computed.gradePoint ?? "-")
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-6 pt-3 text-sm">
          <div>
            <span className="text-muted-foreground">Credits: </span>
            <span className="font-semibold tabular-nums">
              {sgpi.totalCredits}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">CGP: </span>
            <span className="font-semibold tabular-nums">
              {sgpi.totalCreditPoints}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
