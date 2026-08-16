"use client"

import { useTransition } from "react"
import { CheckIcon, ChevronsUpDownIcon, FlaskConicalIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { DevPersona } from "@/lib/dev-personas"
import { setDevActor } from "@/lib/dev-auth-actions"

/**
 * Who you are, locally, without signing in.
 *
 * Rendered only when the server says impersonation is on, which is why this
 * takes its personas as a prop rather than importing them: with the gate off,
 * nothing here reaches the client bundle at all.
 *
 * Deliberately does not look like the rest of the product. A dashed border and
 * a flask are there so that a screenshot taken from a contributor's laptop is
 * never mistaken for the real application, and so nobody spends an afternoon
 * looking for this control in production.
 */
export function DevActorSwitcher({
  personas,
  current,
}: {
  personas: DevPersona[]
  current: string | null
}) {
  const [pending, start] = useTransition()
  const active = personas.find((p) => p.key === current) ?? null

  const choose = (key: string | null) => start(() => void setDevActor(key))

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                disabled={pending}
                className="border-attention/50 hover:bg-attention/5 border border-dashed"
              />
            }
          >
            <div className="text-attention flex aspect-square size-8 items-center justify-center rounded-md border border-dashed">
              <FlaskConicalIcon className="size-4" />
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <span className="truncate text-xs font-semibold">
                {active ? active.name : "Not signed in"}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {active ? active.role : "Pick someone to become"}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 opacity-50" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={4}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-72"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Development only. Authentication is bypassed; every permission
              below is resolved from the database exactly as in production.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {personas.map((p) => (
              <DropdownMenuItem
                key={p.key}
                onClick={() => choose(p.key)}
                className="gap-2"
              >
                <div className="grid flex-1 leading-tight">
                  <span className="text-sm font-medium">
                    {p.name}
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      {p.role}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {p.scope}
                  </span>
                </div>
                {p.key === current && (
                  <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                )}
                {p.key === current && <span className="sr-only">selected</span>}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => choose(null)}
              className="text-muted-foreground text-xs"
            >
              Sign out — fall back to the real VOSS login
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
