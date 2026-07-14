import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionUser, isUnbound } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // An account VOSS authenticated but VERP cannot place must never reach the
  // dashboard. It used to default to the student role and render a dashboard
  // built from an empty record; now it gets an explanation instead. This runs
  // above every dashboard route, so no page has to remember to check.
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (isUnbound(user)) redirect("/unclaimed")

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
