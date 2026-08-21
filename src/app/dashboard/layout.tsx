import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { CommandPalette } from "@/components/command-palette"
import { SessionProvider } from "@/components/session-provider"
import type { ScopeClass, ScopeDept } from "@/components/session-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getSessionUser, isUnbound, type SessionUser } from "@/lib/session"
import { devAuthProps } from "@/lib/dev-auth"
import { expectedYear } from "@/lib/roll-number"
import { listDepartments } from "@/db/queries/departments"
import { getClassesByIds } from "@/db/queries/onboarding"
import { getStudentById } from "@/db/queries/students"

export const dynamic = "force-dynamic"

type ScopeFacts = {
  scopeDepts: ScopeDept[]
  scopeClasses: ScopeClass[]
  rollNumber: string | null
}

const NO_SCOPE: ScopeFacts = {
  scopeDepts: [],
  scopeClasses: [],
  rollNumber: null,
}

async function scopeFacts(user: SessionUser): Promise<ScopeFacts> {
  if (user.tier === "hod" && user.deptCodes.length > 0) {
    const all = await listDepartments()
    return {
      ...NO_SCOPE,
      scopeDepts: all
        .filter((d) => user.deptCodes.includes(d.code))
        .map((d) => ({ code: d.code, name: d.name })),
    }
  }
  if (user.tier === "faculty" && user.classIds.length > 0) {
    const now = new Date()
    const rows = await getClassesByIds(user.classIds)
    return {
      ...NO_SCOPE,
      scopeClasses: rows.map((c) => ({
        id: c.id,
        classKey: c.classKey,
        label: `${expectedYear(c.admissionYear, now) ?? c.admissionYear} · ${c.departmentCode} · ${c.division}`,
      })),
    }
  }
  if (user.tier === "student" && user.studentId) {
    const student = await getStudentById(user.studentId)
    return { ...NO_SCOPE, rollNumber: student?.rollNumber ?? null }
  }
  return NO_SCOPE
}

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
  const scope = await scopeFacts(user)

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
        ...scope,
      }}
    >
      <SidebarProvider>
        <AppSidebar devAuth={devAuth} />
        <SidebarInset className="reveal-stack">{children}</SidebarInset>
        {/* Mounted once at the layout so Cmd+K works from every page, rather
            than each page remembering to include it. */}
        <CommandPalette />
      </SidebarProvider>
    </SessionProvider>
  )
}
