import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPalette } from "@/components/command-palette"
import { SessionProvider } from "@/components/session-provider"
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

  // Resolved once here and handed down, rather than every client component
  // fetching /api/me for itself.
  return (
    <SessionProvider
      session={{
        name: user.name,
        email: user.email,
        image: user.image,
        tier: user.tier,
        facultyId: user.facultyId,
        studentId: user.studentId,
        deptCodes: user.deptCodes,
        classIds: user.classIds,
        coordinatorClassIds: user.coordinatorClassIds,
        capabilities: [...user.capabilities],
      }}
    >
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
        {/* Mounted once at the layout so Cmd+K works from every page, rather
            than each page remembering to include it. */}
        <CommandPalette />
      </SidebarProvider>
    </SessionProvider>
  )
}
