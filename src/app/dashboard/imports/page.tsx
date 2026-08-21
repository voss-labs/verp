import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import {
  importScopeFor,
  listImportBatches,
  latestImportByKind,
} from "@/db/queries/import-batches"
import type { ImportKind } from "@/db/schema/import-batches"
import { ImportsClient, type ImportCard, type BatchRow } from "./client"

export const dynamic = "force-dynamic"

const stamp = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d)

export default async function ImportsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const allowed: Record<ImportKind, boolean> = {
    roster: can(user, "student:update"),
    faculty: can(user, "faculty:create"),
    courses: can(user, "course:create"),
    marks: can(user, "marks:write"),
  }
  const kinds = (Object.keys(allowed) as ImportKind[]).filter((k) => allowed[k])
  if (kinds.length === 0) redirect("/dashboard")

  const scope = importScopeFor(user)

  const [batches, latest] = await Promise.all([
    listImportBatches({ scope, kinds, limit: 200 }),
    Promise.all(kinds.map((k) => latestImportByKind(k, scope))),
  ])

  const lastByKind = new Map(
    latest
      .filter((b) => b !== null)
      .map((b) => [
        b.kind,
        {
          when: stamp(b.createdAt),
          by: b.actorName ?? "Unknown",
          rows: b.rowCount,
        },
      ])
  )

  const marksHref =
    user.classIds.length === 1
      ? `/dashboard/class/${user.classIds[0]}/marks/import`
      : "/dashboard/class"

  const catalogue: Record<ImportKind, Omit<ImportCard, "kind" | "last">> = {
    roster: {
      title: "Student roster",
      description:
        "An Excel sheet of students: roll number, first and last name, email, department, division and year. Marks, SGPI and attendance are never imported.",
      href: "/dashboard/students/import",
      template: {
        fileName: "verp-roster-template.csv",
        headers: [
          "Roll Number",
          "First Name",
          "Last Name",
          "Email",
          "Department",
          "Division",
          "Year",
        ],
      },
    },
    faculty: {
      title: "Faculty",
      description:
        "A CSV of teaching staff: name, email and employee ID, one member per row. Each row may also be assigned to one class as coordinator or TR.",
      href: "/dashboard/dept/faculty-import",
      template: {
        fileName: "verp-faculty-template.csv",
        headers: ["First Name", "Last Name", "Email", "Employee ID"],
      },
    },
    courses: {
      title: "Syllabus",
      description:
        "A Scheme and Syllabus PDF. The scheme table gives each course's code, credits and marks split; the per-course pages give the names.",
      href: "/dashboard/dept/courses/import",
      template: null,
    },
    marks: {
      title: "Marks",
      description:
        "A PDF or Excel marksheet with a roll number, a name and one column per component (ISA, MSE 1, MSE 2, ESE). Roll numbers are matched to the class.",
      href: marksHref,
      template: {
        fileName: "verp-marks-template.csv",
        headers: ["Roll No", "Name", "ISA", "MSE 1", "MSE 2", "ESE"],
      },
    },
  }

  const cards: ImportCard[] = kinds.map((kind) => ({
    kind,
    ...catalogue[kind],
    last: lastByKind.get(kind) ?? null,
  }))

  const rows: BatchRow[] = batches.map((b) => ({
    id: b.id,
    when: stamp(b.createdAt),
    kind: b.kind,
    fileName: b.fileName,
    rowCount: b.rowCount,
    insertedCount: b.insertedCount,
    updatedCount: b.updatedCount,
    skippedCount: b.skippedCount,
    scopeLabel: b.scopeLabel,
    actorName: b.actorName ?? "Unknown",
    status: b.status,
    errorSummary: b.errorSummary,
  }))

  return (
    <>
      <PageHeader
        title="Import center"
        parent="Import"
        parentHref="/dashboard/imports"
        description="Every file VERP accepts, what it must contain, and what each upload did."
      />
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <ImportsClient cards={cards} batches={rows} />
      </div>
    </>
  )
}
