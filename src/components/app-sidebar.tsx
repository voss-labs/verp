"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  UsersIcon,
  BookOpenIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useUserRole } from "@/hooks/use-user-role"
import { VossMark } from "@/components/voss-logo"

const teams = [
  {
    name: "VOSS",
    logo: <VossMark className="text-base" />,
    plan: "VERP · Vidyalankar ERP",
  },
]

// MVP surface only: roster and identity. Marks / attendance / courses come back
// with the features that own them, each adding its own nav.
const adminNav = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    isActive: true,
    items: [{ title: "Overview", url: "/dashboard" }],
  },
  {
    title: "Students",
    url: "/dashboard/students",
    icon: <UsersIcon />,
    items: [
      { title: "All Students", url: "/dashboard/students" },
      { title: "Import Roster", url: "/dashboard/students/import" },
    ],
  },
  {
    title: "Faculty",
    url: "/dashboard/faculty",
    icon: <BookOpenIcon />,
    items: [{ title: "All Faculty", url: "/dashboard/faculty" }],
  },
  {
    title: "Activity Log",
    url: "/dashboard/audit",
    icon: <ScrollTextIcon />,
    items: [{ title: "All Logs", url: "/dashboard/audit" }],
  },
]

// TRs upload their division's roster; that is the faculty MVP.
const facultyNav = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    isActive: true,
    items: [{ title: "Overview", url: "/dashboard" }],
  },
  {
    title: "Students",
    url: "/dashboard/students",
    icon: <UsersIcon />,
    items: [
      { title: "All Students", url: "/dashboard/students" },
      { title: "Import Roster", url: "/dashboard/students/import" },
    ],
  },
]

const studentNav = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    isActive: true,
    items: [{ title: "Overview", url: "/dashboard" }],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const { role } = useUserRole()

  const user = {
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
    avatar: session?.user?.image ?? "",
  }

  // Empty for an unbound (pending) user — they see the shell, not a menu they
  // cannot use. Never default to adminNav: role null is not an admin.
  let navItems: typeof adminNav = []
  if (role === "admin") navItems = adminNav
  else if (role === "faculty") navItems = facultyNav
  else if (role === "student") navItems = studentNav

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
