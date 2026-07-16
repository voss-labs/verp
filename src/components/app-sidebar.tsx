"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  UsersIcon,
  BookOpenIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  ShieldIcon,
  Building2Icon,
  UploadIcon,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useUserRole } from "@/hooks/use-user-role"
import { VossMark } from "@/components/voss-logo"

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
    title: "My Department",
    url: "/dashboard/dept",
    icon: <Building2Icon />,
    items: [{ title: "Classes", url: "/dashboard/dept" }],
  },
  {
    title: "Students",
    url: "/dashboard/students",
    icon: <UsersIcon />,
    items: [{ title: "All Students", url: "/dashboard/students" }],
  },
  {
    title: "Import",
    url: "/dashboard/students/import",
    icon: <UploadIcon />,
    items: [
      { title: "Import roster", url: "/dashboard/students/import" },
      { title: "Import faculty", url: "/dashboard/dept/faculty-import" },
    ],
  },
  {
    title: "Faculty",
    url: "/dashboard/faculty",
    icon: <BookOpenIcon />,
    items: [{ title: "All Faculty", url: "/dashboard/faculty" }],
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
    title: "Departments",
    url: "/dashboard/dept",
    icon: <Building2Icon />,
    items: [{ title: "Classes", url: "/dashboard/dept" }],
  },
  {
    title: "Students",
    url: "/dashboard/students",
    icon: <UsersIcon />,
    items: [{ title: "All Students", url: "/dashboard/students" }],
  },
  {
    title: "Import",
    url: "/dashboard/students/import",
    icon: <UploadIcon />,
    items: [
      { title: "Import roster", url: "/dashboard/students/import" },
      { title: "Import faculty", url: "/dashboard/dept/faculty-import" },
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

// Coordinators/TRs own their classes: approve enrolments, manage the roster.
const facultyNav = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    isActive: true,
    items: [{ title: "Overview", url: "/dashboard" }],
  },
  {
    title: "My Classes",
    url: "/dashboard/class",
    icon: <Building2Icon />,
    items: [{ title: "Classes & requests", url: "/dashboard/class" }],
  },
  {
    title: "Students",
    url: "/dashboard/students",
    icon: <UsersIcon />,
    items: [{ title: "All Students", url: "/dashboard/students" }],
  },
  {
    title: "Import",
    url: "/dashboard/students/import",
    icon: <UploadIcon />,
    items: [{ title: "Import roster", url: "/dashboard/students/import" }],
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="pointer-events-none data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
                <VossMark className="text-base" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">VOSS</span>
                <span className="text-muted-foreground truncate text-xs">
                  VERP · Vidyalankar ERP
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
