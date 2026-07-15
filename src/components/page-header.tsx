"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { useUserRole } from "@/hooks/use-user-role"

const TIER_LABEL = {
  super_admin: "Super-admin",
  hod: "HOD",
  faculty: "Faculty",
  student: "Student",
} as const

export function PageHeader({
  title,
  parent,
  parentHref,
}: {
  title: string
  parent?: string
  parentHref?: string
}) {
  const { tier } = useUserRole()
  return (
    <header className="bg-card flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {parent && (
              <>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href={parentHref ?? "/dashboard"}>
                    {parent}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {tier && (
          <Badge variant="outline" className="ml-auto font-medium">
            {TIER_LABEL[tier]}
          </Badge>
        )}
      </div>
    </header>
  )
}
