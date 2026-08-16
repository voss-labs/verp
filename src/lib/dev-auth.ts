// Signing in as somebody without signing in.
//
// A contributor cannot register VERP as a VOSS client, so before this the only
// way to see any authenticated screen was to hold production OAuth credentials.
// That is why the setup instructions had been unfollowable: the app ran, and
// then redirected you to a login you could not complete.
//
// ── What is bypassed, and what is not ────────────────────────────────────
//
// AUTHENTICATION only. getSessionUser() takes four fields from Better Auth —
// id, name, email, image — and resolves tier, department and class scope, and
// the whole capability set from the database. This substitutes those four
// fields and nothing else, so every authorization rule downstream runs exactly
// as it does in production, against real rows. Switching to the HOD of EXTC
// does not grant EXTC: it becomes a user whose faculty row says so, and the
// same query decides the rest.
//
// That distinction is the point. A mock that returned a fabricated capability
// set would let a contributor "test RBAC" against a fiction and ship a change
// that fails the moment it meets a real session.
//
// ── Why this cannot reach production ─────────────────────────────────────
//
// Three independent locks, any one of which is sufficient:
//
//   1. NODE_ENV must not be "production". `next build` and `next start` both
//      set it, so a deployed bundle fails here regardless of configuration.
//   2. VERP_DEV_AUTH must be exactly "1". Absent by default; no deployment
//      sets it by accident.
//   3. next.config.ts refuses to BUILD when both a production build and this
//      flag are present, so the artifact cannot be produced in the first place.
//
// The order matters: NODE_ENV is read first and is not something a .env file in
// a deployment can talk its way past.

import { cookies } from "next/headers"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import * as schema from "@/db/schema"
import { DEV_PERSONAS, findPersona } from "@/lib/dev-personas"
import { DEV_ACTOR_COOKIE, devAuthEnabled } from "@/lib/dev-auth-gate"

export { DEV_ACTOR_COOKIE, devAuthEnabled } from "@/lib/dev-auth-gate"

export type DevIdentity = {
  id: string
  name: string
  email: string
  image: string | null
}

/**
 * The identity the dev cookie names, or null to fall through to real auth.
 *
 * Null on every uncertainty — gate off, no cookie, unknown persona, or no such
 * user row — because falling through lands on the real login, which is a
 * correct outcome. Inventing a session here would be the failure mode this
 * whole file is trying to avoid.
 */
export async function devIdentity(): Promise<DevIdentity | null> {
  if (!devAuthEnabled()) return null

  const key = (await cookies()).get(DEV_ACTOR_COOKIE)?.value
  // Only the seeded personas, never an arbitrary email from the cookie. The
  // cookie is attacker-controlled input even locally, and "become any address"
  // is a bigger hole than this needs to be.
  const persona = findPersona(key)
  if (!persona) return null

  const row = await db.query.user.findFirst({
    where: eq(schema.user.email, persona.email),
    columns: { id: true, name: true, email: true, image: true },
  })
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image ?? null,
  }
}

/**
 * What the sidebar needs to render the switcher, or null to render nothing.
 *
 * Every shell that mounts AppSidebar asks this rather than reading the flag
 * itself: a second copy of the condition is a second place for it to be wrong,
 * and being wrong here means shipping an impersonation control.
 */
export async function devAuthProps(): Promise<{
  personas: typeof DEV_PERSONAS
  current: string | null
} | null> {
  if (!devAuthEnabled()) return null
  return {
    personas: DEV_PERSONAS,
    current: (await cookies()).get(DEV_ACTOR_COOKIE)?.value ?? null,
  }
}
