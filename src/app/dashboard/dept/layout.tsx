import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"

// The HOD's surface (super_admin may also enter, scoped to all departments).
// Every mutation re-checks dept scope in its server action.
export default async function DeptLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.tier !== "hod" && user.tier !== "super_admin") redirect("/dashboard")
  return <>{children}</>
}
