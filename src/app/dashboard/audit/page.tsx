import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { AuditLogClient } from "./client"
import { getSessionUser } from "@/lib/session"
import { can } from "@/lib/rbac"
import { getAuditLogs, getAuditActionTypes } from "@/db/queries"

export const dynamic = "force-dynamic"

export default async function AuditPage() {
  const user = await getSessionUser()
  if (!user) return redirect("/login")
  if (!can(user, "audit:read")) {
    return (
      <>
        <PageHeader title="Activity log" />
        <div className="p-4 lg:p-6">
          <p className="text-muted-foreground text-sm">
            You do not have access to the activity log.
          </p>
        </div>
      </>
    )
  }

  const [logs, actionTypes] = await Promise.all([
    getAuditLogs({ limit: 100 }),
    getAuditActionTypes(),
  ])

  return (
    <>
      <PageHeader
        title="Activity log"
        parent="Admin"
        parentHref="/dashboard"
        description="The last 100 recorded actions — who did what, to which record, and when"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <AuditLogClient
          logs={logs.map((l) => ({
            id: l.id,
            action: l.action,
            actorName: l.actorName ?? "System",
            targetType: l.targetType,
            targetId: l.targetId,
            details: l.details as Record<string, unknown> | null,
            createdAt: l.createdAt.toISOString(),
          }))}
          actionTypes={actionTypes}
        />
      </div>
    </>
  )
}
