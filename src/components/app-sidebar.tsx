"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
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
  GraduationCapIcon,
  UsersIcon,
  BookOpenIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  IndianRupeeIcon,
  SettingsIcon,
  LayoutDashboardIcon,
  ClockIcon,
  FileTextIcon,
  ClipboardListIcon,
  LayersIcon,
  ScrollTextIcon,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { useUserRole } from "@/hooks/use-user-role"

const teams = [
  {
    name: "VERP",
    logo: <GraduationCapIcon />,
    plan: "Vidyalankar ERP",
  },
]

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
      { title: "Promote Students", url: "/dashboard/admin/promote" },
    ],
  },
  {
    title: "Faculty",
    url: "/dashboard/faculty",
    icon: <BookOpenIcon />,
    items: [{ title: "All Faculty", url: "/dashboard/faculty" }],
  },
  {
    title: "Courses",
    url: "/dashboard/courses",
    icon: <FileTextIcon />,
    items: [{ title: "All Courses", url: "/dashboard/courses" }],
  },
  {
    title: "Offerings",
    url: "/dashboard/offerings",
    icon: <LayersIcon />,
    items: [{ title: "Current Semester", url: "/dashboard/offerings" }],
  },
  {
    title: "Marks",
    url: "/dashboard/marks",
    icon: <ClipboardListIcon />,
    items: [
      { title: "Enter Marks", url: "/dashboard/marks" },
      { title: "CGPA Calculator", url: "/dashboard/sgpi" },
    ],
  },
  {
    title: "Attendance",
    url: "/dashboard/attendance",
    icon: <ClipboardCheckIcon />,
    items: [{ title: "Records", url: "/dashboard/attendance" }],
  },
  {
    title: "Activity Log",
    url: "/dashboard/audit",
    icon: <ScrollTextIcon />,
    items: [{ title: "All Logs", url: "/dashboard/audit" }],
  },
  {
    title: "Examinations",
    url: "#",
    icon: <CalendarIcon />,
    items: [
      { title: "Schedule", url: "#" },
      { title: "Results", url: "#" },
    ],
  },
  {
    title: "Settings",
    url: "#",
    icon: <SettingsIcon />,
    items: [
      { title: "General", url: "#" },
      { title: "Users & Roles", url: "#" },
    ],
  },
]

const facultyNav = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    isActive: true,
    items: [{ title: "Overview", url: "/dashboard" }],
  },
  {
    title: "My Courses",
    url: "/dashboard/marks",
    icon: <ClipboardListIcon />,
    items: [{ title: "Enter Marks", url: "/dashboard/marks" }],
  },
  {
    title: "Attendance",
    url: "/dashboard/attendance",
    icon: <ClipboardCheckIcon />,
    items: [{ title: "Records", url: "/dashboard/attendance" }],
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
  {
    title: "My Marks",
    url: "/dashboard/my-marks",
    icon: <ClipboardListIcon />,
    items: [{ title: "View Marks", url: "/dashboard/my-marks" }],
  },
  {
    title: "Attendance",
    url: "/dashboard/attendance",
    icon: <ClipboardCheckIcon />,
    items: [{ title: "Records", url: "/dashboard/attendance" }],
  },
]

const quickAccess = [
  {
    name: "Fees & Finance",
    url: "#",
    icon: <IndianRupeeIcon />,
  },
  {
    name: "Timetable",
    url: "#",
    icon: <ClockIcon />,
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

  let navItems = adminNav
  if (role === "faculty") navItems = facultyNav
  else if (role === "student") navItems = studentNav

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavProjects projects={quickAccess} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
