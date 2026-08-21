import Link from "next/link"
import { redirect } from "next/navigation"
import { UploadIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button-variants"
import { StudentsClient } from "./client"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { currentYear } from "@/lib/roll-number"
import {
  getAllStudents,
  getStudentsByClassKeys,
  getStudentsByDepartments,
} from "@/db/queries/students"
import {
  latestImportByKind,
  type ImportBatchScope,
} from "@/db/queries/import-batches"

export const dynamic = "force-dynamic"

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>
}) {
  const { department } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect("/login")
  // A student has no student:read — they can never reach the roster, by URL or nav.
  if (!can(user, "student:read")) redirect("/dashboard")

  // Scoped: super_admin sees all, an HOD their department, a coordinator only the
  // classes they run. The capability says "may read students"; scope says "which".
  const data =
    user.tier === "super_admin"
      ? await getAllStudents()
      : user.tier === "hod"
        ? await getStudentsByDepartments(user.deptCodes)
        : await getStudentsByClassKeys(user.classKeys)

  const importScope: ImportBatchScope =
    user.tier === "super_admin"
      ? { all: true }
      : user.tier === "hod"
        ? { actorUserId: user.id, scopeLabels: user.deptCodes }
        : { actorUserId: user.id }
  const lastRoster = can(user, "student:update")
    ? await latestImportByKind("roster", importScope)
    : null

  // Year is derived per render, not read from the column: the stored value is a
  // snapshot of import day and goes stale the moment the cohort advances.
  const now = new Date()
  const rows = data.map((s) => ({
    ...s,
    year: currentYear(s.rollNumber, s.year, now, s.graduatedAt),
  }))

  return (
    <>
      <PageHeader
        title="All students"
        parent="Students"
        parentHref="/dashboard/students"
        description="Every student in your scope"
        actions={
          <Link
            href="/dashboard/students/import"
            className={buttonVariants({ variant: "outline" })}
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            Import roster
          </Link>
        }
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <StudentsClient
          data={rows}
          canDeactivate={can(user, "student:deactivate")}
          department={department}
          lastImport={
            lastRoster
              ? {
                  when: new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  }).format(lastRoster.createdAt),
                  by: lastRoster.actorName ?? "Unknown",
                }
              : null
          }
        />
      </div>
    </>
  )
}
