"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

export type NavMainItem = {
  title: string
  url: string
  icon?: React.ReactNode
}

export type NavMainSection = {
  label?: string
  trailing?: boolean
  items: NavMainItem[]
}

const matches = (pathname: string, url: string) =>
  url === "/dashboard"
    ? pathname === url
    : pathname === url || pathname.startsWith(`${url}/`)

export function NavMain({ sections }: { sections: NavMainSection[] }) {
  const pathname = usePathname()
  const active = sections
    .flatMap((s) => s.items.map((i) => i.url))
    .filter((url) => matches(pathname, url))
    .sort((a, b) => b.length - a.length)[0]

  return (
    <>
      {sections.map((section, index) => (
        <Fragment key={section.label ?? index}>
          {section.trailing && <SidebarSeparator className="my-1" />}
          <SidebarGroup>
            {section.label && (
              <SidebarGroupLabel className="text-[10px] tracking-wider uppercase">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={item.url === active}
                    render={<Link href={item.url} />}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </Fragment>
      ))}
    </>
  )
}
