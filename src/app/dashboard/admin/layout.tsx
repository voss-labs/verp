import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"

// The console is the super-admin surface — the door to every CRUD. Guarded here,
// above every admin route, and re-checked in each server action via authorize().
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.tier !== "super_admin") redirect("/dashboard")
  return <>{children}</>
}
