"use client"

import { createAuthClient } from "better-auth/react"
import { genericOAuthClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
})

// signUp is deliberately not exported. VERP cannot create accounts any more —
// they are created at VOSS, which is what verifies the college email.
export const { signIn, signOut, useSession } = authClient
