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
import { useSessionUser } from "@/components/session-provider"
import { contextualRole } from "@/lib/navigation"

/**
 * A segment of the academic context trail: VIT / EXCS / BE A / Data Analytics.
 *
 * The trail is the product's structural signature (spec 3.4). It answers "what
 * scope am I operating in" on every protected page, which a page title alone
 * never did — "Marks" is the same word whether you are looking at one division
 * or another. A segment is a link when the user may move to it and plain text
 * when it is only context.
 */
export type TrailSegment = { label: string; href?: string }

export function PageHeader({
  title,
  parent,
  parentHref,
  trail,
}: {
  title: string
  parent?: string
  parentHref?: string
  trail?: TrailSegment[]
}) {
  const session = useSessionUser()
  // The responsibility, not the database tier: a faculty member coordinating a
  // class is a coordinator here, and "Faculty" told them nothing they did not
  // already know.
  const role = contextualRole({
    tier: session.tier,
    can: () => false,
    isCoordinator: session.coordinatorClassIds.length > 0,
    hasClasses: session.classIds.length > 0,
  })
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
            {trail?.map((seg) => (
              <span key={seg.label} className="contents">
                <BreadcrumbItem className="hidden md:block">
                  {seg.href ? (
                    <BreadcrumbLink href={seg.href}>{seg.label}</BreadcrumbLink>
                  ) : (
                    <span className="text-muted-foreground">{seg.label}</span>
                  )}
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
              </span>
            ))}
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
        {session.tier && (
          <Badge variant="outline" className="ml-auto font-medium">
            {role}
          </Badge>
        )}
      </div>
    </header>
  )
}
