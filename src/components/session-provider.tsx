"use client"

import { createContext, useContext } from "react"
import type { Capability } from "@/lib/rbac"
import { contextualRole } from "@/lib/navigation"

export type ScopeDept = { code: string; name: string }
export type ScopeClass = { id: string; classKey: string; label: string }

/**
 * The signed-in identity, resolved once on the server and handed down.
 *
 * The layout already resolves the full SessionUser before rendering anything.
 * The sidebar and header used to ignore that and fetch /api/me again from the
 * client through a module-global cache, which cost a round trip, rendered
 * "User" until it landed, and produced a text hydration mismatch (React #418)
 * because the server markup and the first client paint disagreed.
 *
 * Capabilities arrive as an array because a Set does not survive the server to
 * client boundary; they are rebuilt into a Set here so `can()` stays O(1).
 */
export type ClientSession = {
  name: string
  email: string
  image: string | null
  tier: "super_admin" | "hod" | "faculty" | "student" | null
  facultyId: string | null
  studentId: string | null
  deptCodes: string[]
  classIds: string[]
  coordinatorClassIds: string[]
  capabilities: Capability[]
  scopeDepts: ScopeDept[]
  scopeClasses: ScopeClass[]
  rollNumber: string | null
  bugReportConfigured: boolean
}

type Ctx = ClientSession & { capabilitySet: ReadonlySet<Capability> }

const SessionContext = createContext<Ctx | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: ClientSession
  children: React.ReactNode
}) {
  const value: Ctx = {
    ...session,
    capabilitySet: new Set(session.capabilities),
  }
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSessionUser(): Ctx {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    // Every dashboard route renders inside the provider, so a missing context
    // is a wiring mistake rather than a state to design around.
    throw new Error("useSessionUser must be used inside SessionProvider")
  }
  return ctx
}

/** Mirrors lib/rbac can(): super_admin is a wildcard, everyone else is a set. */
export function useCan(): (capability: Capability) => boolean {
  const { tier, capabilitySet } = useSessionUser()
  return (capability) => {
    if (!tier) return false
    if (tier === "super_admin") return true
    return capabilitySet.has(capability)
  }
}

/** The one role string every surface reads, so the sidebar and the header can never disagree. */
export function useContextualRole(): string {
  const { tier, classIds, coordinatorClassIds } = useSessionUser()
  return contextualRole({
    tier,
    can: () => false,
    isCoordinator: coordinatorClassIds.length > 0,
    hasClasses: classIds.length > 0,
    isTeacher: classIds.length > coordinatorClassIds.length,
  })
}
