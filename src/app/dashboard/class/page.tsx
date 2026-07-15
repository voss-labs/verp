import Link from "next/link"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { getSessionUser } from "@/lib/session"
import { expectedYear } from "@/lib/roll-number"
import { getClassesByIds } from "@/db/queries/onboarding"

export const dynamic = "force-dynamic"

export default async function ClassIndexPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const classes = await getClassesByIds(user.classIds)
  const now = new Date()

  return (
    <>
      <PageHeader title="My classes" />
      <div className="@container/main flex flex-1 flex-col gap-4 p-4 lg:p-6">
        {classes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            You are not assigned to any class yet. Your HOD assigns
            coordinators.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => {
              const yr = expectedYear(c.admissionYear, now) ?? c.admissionYear
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/class/${c.id}`}
                  className="border-border bg-card hover:border-blue/50 rounded-xl border p-5 transition-colors"
                >
                  <p className="font-medium">
                    {yr} · {c.departmentCode} · {c.division}
                  </p>
                  <p className="text-muted-foreground mt-1 font-mono text-xs">
                    {c.classKey}
                  </p>
                  {!c.isActive && (
                    <Badge variant="secondary" className="mt-2">
                      inactive
                    </Badge>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
