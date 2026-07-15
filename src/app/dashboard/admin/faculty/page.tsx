import { PageHeader } from "@/components/page-header"

export const dynamic = "force-dynamic"

export default function AdminFacultyPage() {
  return (
    <>
      <PageHeader
        title="Faculty"
        parent="Administration"
        parentHref="/dashboard/admin"
      />
      <div className="p-4 lg:p-6">
        <p className="text-muted-foreground text-sm">
          Add faculty, set their tier, and appoint HODs — building this next.
        </p>
      </div>
    </>
  )
}
