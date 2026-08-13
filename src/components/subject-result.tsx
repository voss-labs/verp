import { Badge } from "@/components/ui/badge"
import {
  computeMarks,
  marksState,
  type CourseInfo,
  type MarksInput,
} from "@/lib/sgpi"

/**
 * The Total, %, and Grade cells of a subject row.
 *
 * One component because three screens show the same three numbers and had
 * drifted apart: the overview read 0/75 where My marks read a dash, for the
 * same subject on the same day. Whichever is right, a student cannot be shown
 * both.
 *
 * The three states read differently on purpose. Nothing entered is a dash --
 * there is no fact to report. Partly entered shows the running total with
 * "provisional" attached, because the sum is real but not final: until both
 * MSEs exist their component counts nothing, so the figure is genuinely lower
 * than the student has scored and stating it unqualified would be a lie. Only a
 * fully marked subject gets a percentage and a grade.
 */
export function SubjectResultCells({
  marks,
  course,
}: {
  marks: MarksInput
  course: CourseInfo
}) {
  const c = computeMarks(marks, course)
  const state = marksState(marks, course)

  return (
    <>
      <td className="tabular-nums">
        {state === "empty" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            {c.total}
            <span className="text-muted-foreground text-xs">
              /{course.maxTotal}
            </span>
          </>
        )}
      </td>
      <td className="text-muted-foreground tabular-nums">
        {state === "graded" ? (
          c.percentage
        ) : state === "partial" ? (
          <span className="text-xs">provisional</span>
        ) : (
          "—"
        )}
      </td>
      <td>
        {state === "graded" ? (
          c.gradePoint === "Fail" ? (
            <Badge variant="destructive">Fail</Badge>
          ) : (
            <Badge variant="outline">{c.gradePoint}</Badge>
          )
        ) : state === "partial" ? (
          <span className="text-muted-foreground text-xs">In progress</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </>
  )
}
