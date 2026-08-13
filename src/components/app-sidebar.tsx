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
  ShieldIcon,
  Building2Icon,
  UploadIcon,
  GraduationCapIcon,
} from "lucide-react"

// One icon per domain, so a new page inherits the right one by naming its
// domain rather than by editing a list.
const DOMAIN_ICON: Record<string, React.ReactNode> = {
  Overview: <LayoutDashboardIcon />,
  Academics: <BookOpenIcon />,
  Organization: <Building2Icon />,
  People: <UsersIcon />,
  Import: <UploadIcon />,
  Administration: <ShieldIcon />,
  "My academics": <GraduationCapIcon />,
}
import { useSessionUser, useCan } from "@/components/session-provider"
import { buildNavigation } from "@/lib/navigation"
import { openCommandPalette } from "@/components/command-palette"
import { SearchIcon } from "lucide-react"
import { VossMark } from "@/components/voss-logo"

// MVP surface only: roster and identity. Marks / attendance / courses come back
// with the features that own them, each adding its own nav.
// Super-admin also gets the console — the door to every CRUD.
// Coordinators/TRs own their classes: approve enrolments, manage the roster.
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Server-resolved, so the first paint already knows who this is. Reading it
  // from the session hook meant rendering "User" until a fetch returned, which
  // is what produced the identity flicker and the hydration mismatch.
  const session = useSessionUser()
  const can = useCan()
  const user = {
    name: session.name,
    email: session.email,
    avatar: session.image ?? "",
  }
  const navItems = buildNavigation({
    tier: session.tier,
    can,
    isCoordinator: session.coordinatorClassIds.length > 0,
    hasClasses: session.classIds.length > 0,
  }).map((d) => ({
    title: d.domain,
    url: d.url,
    icon: DOMAIN_ICON[d.domain] ?? <LayoutDashboardIcon />,
    isActive: d.domain === "Overview",
    items: d.items,
  }))

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
        <SidebarMenu className="px-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={openCommandPalette}
              tooltip="Search (⌘K)"
            >
              <SearchIcon />
              <span>Search</span>
              <kbd className="text-muted-foreground ml-auto text-[10px] group-data-[collapsible=icon]:hidden">
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
