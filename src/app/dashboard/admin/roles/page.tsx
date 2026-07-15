import { PageHeader } from "@/components/page-header"

export const dynamic = "force-dynamic"

export default function AdminRolesPage() {
  return (
    <>
      <PageHeader
        title="Roles & permissions"
        parent="Administration"
        parentHref="/dashboard/admin"
      />
      <div className="p-4 lg:p-6">
        <p className="text-muted-foreground text-sm">
          The capability toggle matrix over the fixed tier defaults — building
          this next.
        </p>
      </div>
    </>
  )
}
