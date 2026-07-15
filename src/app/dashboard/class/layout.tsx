import { redirect } from "next/navigation"
import { getSessionUser, isStaff } from "@/lib/session"

export const dynamic = "force-dynamic"

// Staff-only; the specific-class scope is checked per class in the page/actions.
export default async function ClassLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!isStaff(user)) redirect("/dashboard")
  return <>{children}</>
}
