import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPalette } from "@/components/command-palette"
import { SessionProvider } from "@/components/session-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionUser, isUnbound } from "@/lib/session"
import { devAuthProps } from "@/lib/dev-auth"

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

  // Null unless this is a development machine with the flag on, and a null prop
  // means the switcher and its persona list never reach the browser.
  const devAuth = await devAuthProps()

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
        <AppSidebar devAuth={devAuth} />
        <SidebarInset>{children}</SidebarInset>
        {/* Mounted once at the layout so Cmd+K works from every page, rather
            than each page remembering to include it. */}
        <CommandPalette />
      </SidebarProvider>
    </SessionProvider>
  )
}
