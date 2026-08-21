import { MarksSplitBar } from "@/components/marks-split-bar"
import { computeMarks, type CourseInfo, type MarksInput } from "@/lib/sgpi"

/** Where a subject's total comes from: every component, the MSE averaging rule, and the split bar. */
export function SubjectBreakdown({
  marks,
  course,
}: {
  marks: MarksInput
  course: CourseInfo
}) {
  const c = computeMarks(marks, course)
  const hasMse = course.maxMse > 0
  const bothMse = marks.mse1 != null && marks.mse2 != null

  const components = [
    { label: "ISA", value: mark(marks.isa, course.maxIsa) },
    ...(hasMse
      ? [
          { label: "MSE 1", value: mark(marks.mse1, course.maxMse) },
          { label: "MSE 2", value: mark(marks.mse2, course.maxMse) },
          { label: "MSE counted", value: mark(c.finalMse, course.maxMse) },
        ]
      : []),
    { label: "ESE", value: mark(marks.ese, course.maxEse) },
    { label: "Total", value: `${c.total}/${course.maxTotal}` },
    {
      label: "Percentage",
      value: c.percentage == null ? "—" : `${c.percentage}%`,
    },
    {
      label: "Grade point",
      value: c.gradePoint == null ? "—" : String(c.gradePoint),
    },
  ]

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:gap-8">
      <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-4">
        {components.map((component) => (
          <div key={component.label}>
            <dt className="text-muted-foreground text-xs">{component.label}</dt>
            <dd className="identifier mt-0.5">{component.value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2 xl:w-72">
        <h3 className="text-xs font-semibold">Where the total comes from</h3>
        <MarksSplitBar
          total={course.maxTotal}
          segments={[
            { label: "ISA", value: marks.isa ?? 0 },
            ...(hasMse ? [{ label: "MSE", value: c.finalMse ?? 0 }] : []),
            { label: "ESE", value: marks.ese ?? 0 },
          ]}
        />
        <p className="text-muted-foreground text-xs">
          {!hasMse
            ? "This subject has no MSE. ISA and ESE make up the whole total."
            : bothMse
              ? "MSE counts the average of MSE 1 and MSE 2, rounded to the nearest mark."
              : "MSE counts the average of both papers, so it stays out of the total until MSE 1 and MSE 2 are both in."}
        </p>
        {c.percentage == null && (
          <p className="text-muted-foreground text-xs">
            Not every component is in yet, so no grade is calculated. This is
            what your teachers have entered so far.
          </p>
        )}
      </section>
    </div>
  )
}

function mark(value: number | null, max: number) {
  return value == null ? "—" : `${value}/${max}`
}
