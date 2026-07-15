import { redirect } from "next/navigation"
import { sql } from "drizzle-orm"
import { PageHeader } from "@/components/page-header"
import { getSessionUser } from "@/lib/session"
import { db } from "@/db"
import * as schema from "@/db/schema"

export const dynamic = "force-dynamic"

// Honest overview. Real counts, no fabricated numbers, no demo chart — the
// role-specific dashboards (console / dept / class / student) replace this as
// each ships. The layout already redirects unbound users to the pending screen.
export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const staff =
    user.tier === "super_admin" ||
    user.tier === "hod" ||
    user.tier === "faculty"

  const active = sql`is_active`
  const c = sql<number>`count(*)::int`
  const cards = staff
    ? await Promise.all([
        db
          .select({ c })
          .from(schema.departments)
          .where(active)
          .then((r) => ({ label: "Departments", value: r[0]?.c ?? 0 })),
        db
          .select({ c })
          .from(schema.classes)
          .where(active)
          .then((r) => ({ label: "Classes", value: r[0]?.c ?? 0 })),
        db
          .select({ c })
          .from(schema.students)
          .where(active)
          .then((r) => ({ label: "Students", value: r[0]?.c ?? 0 })),
        db
          .select({ c })
          .from(schema.faculty)
          .where(active)
          .then((r) => ({ label: "Faculty", value: r[0]?.c ?? 0 })),
      ])
    : []

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="@container/main flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Welcome, {user.name || user.email}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {staff
              ? "Your workspace across VERP."
              : "Your attendance and marks will appear here once your class coordinator uploads them."}
          </p>
        </div>

        {staff && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="border-border bg-card rounded-xl border p-5"
              >
                <p className="text-muted-foreground text-sm">{c.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
