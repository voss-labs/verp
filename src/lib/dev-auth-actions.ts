"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { DEV_ACTOR_COOKIE, devAuthEnabled } from "@/lib/dev-auth"
import { findPersona } from "@/lib/dev-personas"

/**
 * Become one of the seeded personas, or stop being anybody.
 *
 * The gate is re-checked here and not only where the switcher renders. Hiding a
 * control is a decision about the UI; this is a server action, and a server
 * action is reachable by anyone who can post to the app. If the environment
 * does not permit impersonation, this does nothing at all.
 */
export async function setDevActor(key: string | null) {
  if (!devAuthEnabled()) return

  const jar = await cookies()
  if (key === null) {
    jar.delete(DEV_ACTOR_COOKIE)
  } else {
    // Only a known persona: the cookie is input, and "become any email" is a
    // larger hole than this needs to be even on a laptop.
    if (!findPersona(key)) return
    jar.set(DEV_ACTOR_COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Deliberately a session cookie. Closing the browser forgets who you
      // were, which is the right default for something that is not a login.
    })
  }
  revalidatePath("/", "layout")
}
