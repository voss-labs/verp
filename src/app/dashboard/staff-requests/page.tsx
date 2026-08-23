import { redirect } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { can } from "@/lib/rbac"
import { getSessionUser } from "@/lib/session"
import { listStaffRequests } from "@/db/queries/staff-requests"
import { StaffRequestsClient } from "./client"

export const dynamic = "force-dynamic"

const ARRIVED = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
})

export default async function StaffRequestsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  if (!can(user, "faculty:create")) {
    return (
      <>
        <PageHeader title="Staff requests" />
        <div className="p-4 lg:p-6">
          <p className="text-muted-foreground text-sm">
            You do not have access to staff requests.
          </p>
        </div>
      </>
    )
  }

  const requests = await listStaffRequests({
    deptCodes: user.tier === "super_admin" ? null : user.deptCodes,
    statuses: ["pending"],
  })

  return (
    <>
      <PageHeader
        title="Staff requests"
        description="Staff who signed in before anybody had added them. Approving creates their faculty record and places them on their next sign-in."
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <StaffRequestsClient
          requests={requests.map((r) => ({
            id: r.id,
            name: `${r.firstName} ${r.lastName}`.trim(),
            employeeId: r.employeeId,
            email: r.email,
            deptCode: r.deptCode,
            arrivedAt: ARRIVED.format(r.createdAt),
          }))}
        />
      </div>
    </>
  )
}
