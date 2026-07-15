import { redirect } from "next/navigation"
import { sql } from "drizzle-orm"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { getAttendanceSummaryForStudent } from "@/db/queries/attendance"
import { getMarksForStudent } from "@/db/queries/marks"
import { computeMarks, computeSgpi } from "@/lib/sgpi"
import { Badge } from "@/components/ui/badge"
import { db } from "@/db"
import * as schema from "@/db/schema"

export const dynamic = "force-dynamic"

// Honest overview. Real counts, no fabricated numbers, no demo chart — the
// role-specific dashboards (console / dept / class / student) replace this as
// each ships. The layout already redirects unbound users to the pending screen.
export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const staff =
    user.tier === "super_admin" ||
    user.tier === "hod" ||
    user.tier === "faculty"

  const active = sql`is_active`
  const c = sql<number>`count(*)::int`
  const cards = staff
    ? await Promise.all([
        db
          .select({ c })
          .from(schema.departments)
          .where(active)
          .then((r) => ({ label: "Departments", value: r[0]?.c ?? 0 })),
        db
          .select({ c })
          .from(schema.classes)
          .where(active)
          .then((r) => ({ label: "Classes", value: r[0]?.c ?? 0 })),
        db
          .select({ c })
          .from(schema.students)
          .where(active)
          .then((r) => ({ label: "Students", value: r[0]?.c ?? 0 })),
        db
          .select({ c })
          .from(schema.faculty)
          .where(active)
          .then((r) => ({ label: "Faculty", value: r[0]?.c ?? 0 })),
      ])
    : []

  // A student sees their own attendance.
  const att =
    user.tier === "student" && user.studentId
      ? await getAttendanceSummaryForStudent(user.studentId)
      : null
  const attPct =
    att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null

  // A student's marks across every subject, with per-subject grade and SGPI.
  const marksRows =
    user.tier === "student" && user.studentId
      ? await getMarksForStudent(user.studentId)
      : []
  const marks = marksRows.map((m) => {
    const course = m.courseOffering.course
    return { mark: m, course, computed: computeMarks(m, course) }
  })
  const sgpi = computeSgpi(
    marks.map(({ mark, course }) => ({ marks: mark, course }))
  )

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Welcome, {user.name || user.email}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {staff
              ? "Your workspace across VERP."
              : "Your attendance and marks."}
          </p>
        </div>

        {staff && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="border-border bg-card rounded border p-5"
              >
                <p className="text-muted-foreground text-sm">{c.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {user.tier === "student" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border-border bg-card rounded border p-5">
              <p className="text-muted-foreground text-sm">Attendance</p>
              {attPct === null ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  No sessions recorded yet.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-3xl font-bold tracking-tight">
                    {attPct}%
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {att!.present} of {att!.total} sessions present
                  </p>
                </>
              )}
            </div>
            <div className="border-border bg-card rounded border p-5">
              <p className="text-muted-foreground text-sm">SGPI</p>
              {sgpi.sgpi === null ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  Appears once your marks are recorded.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-3xl font-bold tracking-tight">
                    {sgpi.hasFail ? "—" : sgpi.sgpi.toFixed(2)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {sgpi.hasFail
                      ? "Held — clear all subjects to compute"
                      : `${sgpi.totalCredits} credits`}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {user.tier === "student" && marks.length > 0 && (
          <div className="border-border bg-card overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium">
                  <th>Code</th>
                  <th>Subject</th>
                  <th className="w-16">Total</th>
                  <th className="w-16">%</th>
                  <th className="w-16">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {marks.map(({ mark, course, computed }) => (
                  <tr
                    key={mark.id}
                    className="[&>td]:px-4 [&>td]:py-2.5"
                  >
                    <td className="font-mono text-xs">{course.courseCode}</td>
                    <td>{course.courseName}</td>
                    <td className="tabular-nums">
                      {computed.total} / {course.maxTotal}
                    </td>
                    <td className="text-muted-foreground tabular-nums">
                      {computed.percentage ?? "—"}
                    </td>
                    <td>
                      {computed.gradePoint == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : computed.gradePoint === "Fail" ? (
                        <Badge variant="destructive">Fail</Badge>
                      ) : (
                        <Badge variant="outline">{computed.gradePoint}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
