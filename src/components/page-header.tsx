"use client"

import type { ReactNode } from "react"
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
import {
  useContextualRole,
  useSessionUser,
} from "@/components/session-provider"

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

export type PageHeaderProps = {
  title: string
  parent?: string
  parentHref?: string
  trail?: TrailSegment[]
  description?: string
  actions?: ReactNode
}

export function PageHeader({
  title,
  parent,
  parentHref,
  trail,
  description,
  actions,
}: PageHeaderProps) {
  const session = useSessionUser()
  const role = useContextualRole()
  const coordinated = session.scopeClasses
    .filter((c) => session.coordinatorClassIds.includes(c.id))
    .map((c) => c.classKey)
  return (
    <>
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
                      <BreadcrumbLink href={seg.href}>
                        {seg.label}
                      </BreadcrumbLink>
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
                <BreadcrumbPage className="font-semibold">
                  {title}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          {session.tier && (
            <Badge
              variant="outline"
              className="ml-auto font-medium"
              title={
                coordinated.length > 0
                  ? `Coordinates ${coordinated.join(", ")}`
                  : undefined
              }
            >
              {role}
            </Badge>
          )}
        </div>
      </header>
      {(description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 lg:px-6 lg:pt-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1 text-sm">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}
    </>
  )
}
