"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { useSessionUser, useCan } from "@/components/session-provider"
import { buildNavigation } from "@/lib/navigation"

/**
 * Opening the palette from a visible control.
 *
 * A shortcut nobody is told about does not exist, so the sidebar shows a
 * button. It broadcasts rather than sharing state because the palette is
 * mounted beside the sidebar, not around it — threading a setter through the
 * layout would make a server component hold client state to pass it along.
 */
export const OPEN_PALETTE = "verp:open-command-palette"

export function openCommandPalette() {
  document.dispatchEvent(new CustomEvent(OPEN_PALETTE))
}

/**
 * Cmd+K navigation (spec phase 5).
 *
 * Staff move between a class register, a marks grid and a roster dozens of
 * times an hour, and the sidebar makes each of those two or three clicks
 * through a tree they have to re-read every time. Typing three letters is the
 * whole interaction.
 *
 * Entries come from buildNavigation, the same function the sidebar renders,
 * rather than a second list. A palette with its own list is a list that will
 * disagree: it would keep offering a page after a capability was revoked, and
 * land the user on a Forbidden screen the sidebar had already stopped showing.
 */
export function CommandPalette() {
  const router = useRouter()
  const session = useSessionUser()
  const can = useCan()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl as well as Cmd: the college's lab machines are Windows.
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    document.addEventListener(OPEN_PALETTE, onOpen)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener(OPEN_PALETTE, onOpen)
    }
  }, [])

  const domains = buildNavigation({
    tier: session.tier,
    can,
    isCoordinator: session.coordinatorClassIds.length > 0,
    hasClasses: session.classIds.length > 0,
  })

  const go = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Go to"
      description="Search for a page"
    >
      <CommandInput placeholder="Go to…" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>
        {domains.map((d) => (
          <CommandGroup key={d.domain} heading={d.domain}>
            {d.items.map((item) => (
              <CommandItem
                // The domain is part of the search text, so "people roster"
                // finds the roster even though the link is called "Student
                // roster" — people search for where a thing lives as often as
                // for what it is called.
                key={item.url}
                value={`${d.domain} ${item.title} ${item.url}`}
                onSelect={() => go(item.url)}
              >
                {item.title}
                <CommandShortcut>{d.domain}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
