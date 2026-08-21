"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useSessionUser } from "@/components/session-provider"
import type { ClientSession } from "@/components/session-provider"
import { VossMark } from "@/components/voss-logo"
import { cn } from "@/lib/utils"

type Scope = { primary: string; secondary: string; mono?: boolean }

function describeScope(
  session: ClientSession,
  active: ClientSession["scopeClasses"][number] | undefined
): Scope {
  switch (session.tier) {
    case "super_admin":
      return { primary: "VERP", secondary: "All departments" }
    case "hod": {
      const depts = session.scopeDepts
      if (depts.length === 0) {
        return { primary: "VERP", secondary: "No department appointed" }
      }
      return {
        primary: depts.map((d) => d.code).join(" · "),
        secondary: depts.map((d) => d.name).join(" · "),
        mono: true,
      }
    }
    case "faculty": {
      const classes = session.scopeClasses
      if (classes.length === 0) {
        return { primary: "VERP", secondary: "No class assigned" }
      }
      if (active) {
        return { primary: active.classKey, secondary: active.label, mono: true }
      }
      if (classes.length === 1) {
        return {
          primary: classes[0].classKey,
          secondary: classes[0].label,
          mono: true,
        }
      }
      return {
        primary: `${classes.length} classes`,
        secondary: "Your teaching scope",
      }
    }
    case "student":
      return {
        primary: session.rollNumber ?? "VERP",
        secondary: "My record",
        mono: session.rollNumber !== null,
      }
    default:
      return { primary: "VERP", secondary: "Vidyalankar ERP" }
  }
}

export function ScopeSwitcher() {
  const session = useSessionUser()
  const { isMobile } = useSidebar()
  const pathname = usePathname()

  const classes = session.tier === "faculty" ? session.scopeClasses : []
  const active = classes.find(
    (c) =>
      pathname === `/dashboard/class/${c.id}` ||
      pathname.startsWith(`/dashboard/class/${c.id}/`)
  )
  const scope = describeScope(session, active)

  const label = (
    <>
      <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-md">
        <VossMark className="text-base" />
      </div>
      <div className="grid flex-1 text-left leading-tight">
        <span
          className={cn("truncate font-semibold", scope.mono && "identifier")}
        >
          {scope.primary}
        </span>
        <span className="text-muted-foreground truncate text-xs">
          {scope.secondary}
        </span>
      </div>
    </>
  )

  if (classes.length < 2) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="pointer-events-none data-[slot=sidebar-menu-button]:!p-1.5"
          >
            {label}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground data-[slot=sidebar-menu-button]:!p-1.5"
              />
            }
          >
            {label}
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
            className="max-h-[80vh] min-w-64 overflow-y-auto rounded-lg"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Your classes</DropdownMenuLabel>
              {classes.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  className="gap-2 py-1.5"
                  render={<Link href={`/dashboard/class/${c.id}`} />}
                >
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="identifier truncate">{c.classKey}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {c.label}
                      {session.coordinatorClassIds.includes(c.id) &&
                        " · Coordinator"}
                    </span>
                  </span>
                  {c.id === active?.id && (
                    <>
                      <CheckIcon className="size-4 shrink-0" aria-hidden />
                      <span className="sr-only">current</span>
                    </>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
