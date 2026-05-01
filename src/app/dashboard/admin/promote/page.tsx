import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { PromoteStudentsClient } from "./client"

export const dynamic = "force-dynamic"

export default async function PromoteStudentsPage() {
  const user = await getSessionUser()
  if (!user) return redirect("/login")

  if (user.role !== "admin") {
    return (
      <>
        <PageHeader
          title="Promote Students"
          parent="Admin"
          parentHref="/dashboard"
        />
        <div className="p-4 lg:p-6">
          <p className="text-muted-foreground text-sm">
            Admin access required.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Promote Students"
        parent="Admin"
        parentHref="/dashboard"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <PromoteStudentsClient />
      </div>
    </>
  )
}
