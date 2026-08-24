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
  ScrollTextIcon,
  LibraryIcon,
  LayersIcon,
  UserPlusIcon,
  ClipboardListIcon,
  SearchIcon,
  UserRoundCheckIcon,
} from "lucide-react"
import { useSessionUser, useCan } from "@/components/session-provider"
import { buildNavigation, type NavIcon } from "@/lib/navigation"
import { openCommandPalette } from "@/components/command-palette"
import { ScopeSwitcher } from "@/components/scope-switcher"
import { DevActorSwitcher } from "@/components/dev-actor-switcher"
import type { DevPersona } from "@/lib/dev-personas"

const NAV_ICON: Record<NavIcon, React.ReactNode> = {
  overview: <LayoutDashboardIcon />,
  students: <UsersIcon />,
  faculty: <GraduationCapIcon />,
  departments: <Building2Icon />,
  roles: <ShieldIcon />,
  audit: <ScrollTextIcon />,
  imports: <UploadIcon />,
  classes: <BookOpenIcon />,
  courses: <LibraryIcon />,
  dept: <LayersIcon />,
  appoint: <UserPlusIcon />,
  marks: <ClipboardListIcon />,
  staff: <UserRoundCheckIcon />,
}

export function AppSidebar({
  devAuth,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  // Resolved on the server, because the flag that enables it is not public. Null
  // in every deployed environment, and then nothing below ships to the client.
  devAuth?: { personas: DevPersona[]; current: string | null } | null
}) {
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
  const sections = buildNavigation({
    tier: session.tier,
    can,
    isCoordinator: session.coordinatorClassIds.length > 0,
    hasClasses: session.classIds.length > 0,
    classIds: session.classIds,
  }).map((section) => ({
    label: section.label,
    trailing: section.trailing,
    items: section.items.map((item) => ({
      title: item.title,
      url: item.url,
      icon: NAV_ICON[item.icon],
    })),
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ScopeSwitcher />
        {devAuth && (
          <DevActorSwitcher
            personas={devAuth.personas}
            current={devAuth.current}
          />
        )}
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
        <NavMain sections={sections} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
