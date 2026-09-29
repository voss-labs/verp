import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { listDepartments } from "@/db/queries/departments"
import { ImportClient } from "./client"

export const dynamic = "force-dynamic"

export default async function ImportStudentsPage() {
  // Server-side guard. The API re-checks too — this just avoids rendering the
  // page for someone who can't use it.
  const user = await getSessionUser()
  if (!user || !can(user, "student:update")) redirect("/dashboard")

  // A department only needs setting on a roll whose branch the roll map does
  // not know, and only a super-admin can import one. rollsInScope refuses it
  // for everyone else: an HOD is judged by the branch inside the roll, and a
  // teacher by the classes they hold, which are only ever created for branches
  // the map knows. Offered to them, the menu would read as all clear here and
  // still be refused at import.
  const departments =
    user.tier === "super_admin"
      ? (await listDepartments())
          .filter((d) => d.isActive)
          .map((d) => ({ code: d.code, name: d.name }))
      : []

  return (
    <>
      <PageHeader
        title="Import roster"
        parent="Students"
        parentHref="/dashboard/students"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ImportClient departments={departments} />
      </div>
    </>
  )
}
