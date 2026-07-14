import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { genericOAuth } from "better-auth/plugins"
import { nextCookies } from "better-auth/next-js"
import { db } from "@/db"
import { bindIdentity } from "@/lib/bind"

/** harshal.more@vit.edu.in -> "Harshal More" */
function deriveNameFromEmail(email: string): string {
  const local = email?.split("@")[0] ?? ""
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || email
  )
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // VERP no longer holds credentials. VOSS is the only way in, so there is no
  // password here to steal, reset, or leak. Turning this back on would mean two
  // doors into the same account, and only one of them is being watched.
  emailAndPassword: {
    enabled: false,
  },

  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "voss",
          discoveryUrl: process.env.VOSS_DISCOVERY_URL!,
          clientId: process.env.VOSS_CLIENT_ID!,
          clientSecret: process.env.VOSS_CLIENT_SECRET!,
          scopes: ["openid", "profile", "email"],

          // MUST be true. It defaults to FALSE on the client while VOSS REQUIRES
          // PKCE (OAuth 2.1) — they do not meet in the middle, so without this
          // every sign-in fails at the token endpoint.
          pkce: true,

          // Reject a token whose issuer is not the one discovery advertised.
          requireIssuerValidation: true,

          // `name` is OPTIONAL in OIDC, but VERP stores user.name NOT NULL. When
          // VOSS sent no name claim the insert failed with `name_is_missing` —
          // AFTER the OAuth dance had already succeeded, so the user was bounced
          // back to the login page with no explanation at all.
          //
          // A relying party must never assume an identity provider sends an
          // optional claim. Derive one rather than reject the login.
          mapProfileToUser: (profile) => ({
            name: profile.name?.trim() || deriveNameFromEmail(profile.email),
          }),
        },
      ],
    }),
    nextCookies(),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // The session cookie is already being issued by now, so a throw here
          // must not take the login down — it has to land the user somewhere
          // that explains itself. getSessionUser() treats an unbound account as
          // roleless and the dashboard sends them to /unclaimed.
          try {
            await bindIdentity(user.id, user.email)
          } catch (error) {
            console.error("[bind] failed for", user.email, error)
          }
        },
      },
    },
  },
})
