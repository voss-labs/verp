import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { ImportClient } from "./client"

export const dynamic = "force-dynamic"

export default async function ImportStudentsPage() {
  // Server-side guard. The API re-checks too — this just avoids rendering the
  // page for someone who can't use it.
  const user = await getSessionUser()
  if (!user || !can(user, "student:update")) redirect("/dashboard")

  return (
    <>
      <PageHeader
        title="Import roster"
        parent="Students"
        parentHref="/dashboard/students"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <ImportClient />
      </div>
    </>
  )
}
