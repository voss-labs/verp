import { redirect } from "next/navigation"
import { ScrollTextIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getSessionUser } from "@/lib/session"
import { getAuditLogsByActor } from "@/db/queries"

export const dynamic = "force-dynamic"

const ROW_CAP = 200

const stamp = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d)

export default async function ActivityPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.tier === "super_admin") redirect("/dashboard/audit")
  if (user.tier !== "hod" && user.tier !== "faculty") redirect("/dashboard")

  const logs = await getAuditLogsByActor(user.id, ROW_CAP)

  return (
    <>
      <PageHeader
        title="My activity"
        parent="Overview"
        parentHref="/dashboard"
        description="Everything you changed, newest first"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <p className="text-muted-foreground text-xs font-medium tabular-nums">
          {logs.length} entries
        </p>

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-45">When</TableHead>
                <TableHead className="w-45">Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      icon={ScrollTextIcon}
                      title="No actions yet"
                      description="Changes you make appear here."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">
                      {stamp(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[11px] font-medium"
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="text-muted-foreground">
                        {log.targetType}
                      </span>
                      {log.targetId && (
                        <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 font-mono text-[10px]">
                          {log.targetId.slice(0, 8)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-50 truncate font-mono text-xs">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  )
}
