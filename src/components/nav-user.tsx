"use client"

import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  ChevronsUpDownIcon,
  BadgeCheckIcon,
  BellIcon,
  ExternalLinkIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import {
  useContextualRole,
  useSessionUser,
} from "@/components/session-provider"
import { signOut } from "@/lib/auth-client"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { tier } = useSessionUser()
  const role = useContextualRole()

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login")
        },
      },
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="flex items-center gap-1.5 text-xs">
                {tier && (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1.5 text-[10px] group-data-[collapsible=icon]:hidden"
                  >
                    {role}
                  </Badge>
                )}
                <span className="truncate">{user.email}</span>
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="flex items-center gap-1.5 text-xs">
                      {tier && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[10px]"
                        >
                          {role}
                        </Badge>
                      )}
                      <span className="truncate">{user.email}</span>
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {/*
                Links OUT to accounts.vosslabs.org, deliberately. VERP holds no
                credentials and no profile — the account lives at VOSS, which is
                also where sessions and connected apps are managed. Duplicating
                any of it here would give students two places to change the same
                thing, one of which is not authoritative.

                Same pattern as Gmail linking out to myaccount.google.com.
              */}
              <DropdownMenuItem
                render={
                  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the link's text is this item's children, one level out
                  <a
                    href="https://accounts.vosslabs.org/account"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <BadgeCheckIcon />
                VOSS account
                <ExternalLinkIcon className="ml-auto size-3.5 opacity-50" />
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }}
              >
                {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
                {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
