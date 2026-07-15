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
  ShieldIcon,
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

// Super-admin also gets the console — the door to every CRUD.
const superAdminNav = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    isActive: true,
    items: [{ title: "Overview", url: "/dashboard" }],
  },
  {
    title: "Administration",
    url: "/dashboard/admin",
    icon: <ShieldIcon />,
    items: [
      { title: "Console", url: "/dashboard/admin" },
      { title: "Departments", url: "/dashboard/admin/departments" },
      { title: "Faculty", url: "/dashboard/admin/faculty" },
      { title: "Roles & permissions", url: "/dashboard/admin/roles" },
    ],
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
  const { tier } = useUserRole()

  const user = {
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
    avatar: session?.user?.image ?? "",
  }

  // Empty for an unbound (pending) user — they see the shell, not a menu they
  // cannot use. Never default to adminNav: tier null is not an admin. (HOD shares
  // the admin nav for now; a dedicated dept nav arrives with the HOD dashboard.)
  let navItems: typeof adminNav = []
  if (tier === "super_admin") navItems = superAdminNav
  else if (tier === "hod") navItems = adminNav
  else if (tier === "faculty") navItems = facultyNav
  else if (tier === "student") navItems = studentNav

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
