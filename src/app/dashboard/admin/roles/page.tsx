import { PageHeader } from "@/components/page-header"
import { countUsersByTier, listRoleOverrides } from "@/db/queries/permissions"
import { RolesClient } from "./client"

export const dynamic = "force-dynamic"

export default async function AdminRolesPage() {
  const [overrides, headcount] = await Promise.all([
    listRoleOverrides(),
    countUsersByTier(),
  ])
  return (
    <>
      <PageHeader
        title="Roles & permissions"
        parent="Administration"
        parentHref="/dashboard/admin"
      />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <RolesClient
          overrides={overrides.map((o) => ({
            tier: o.tier,
            capability: o.capability,
            effect: o.effect,
          }))}
          headcount={headcount}
        />
      </div>
    </>
  )
}
