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

  // Stay signed in for 7 days after a VOSS login. The absolute max only bounds how
  // long a FORGOTTEN session survives; updateAge slides an active session's expiry
  // forward daily, so an in-use account is never logged out mid-session. A session
  // can always be revoked centrally (super-admin console + VOSS). Dial to 24h if
  // shared staff/lab machines turn out to be the common case.
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  // VERP no longer holds credentials. VOSS is the only way in, so there is no
  // password here to steal, reset, or leak. Turning this back on would mean two
  // doors into the same account, and only one of them is being watched.
  emailAndPassword: {
    enabled: false,
  },

  account: {
    accountLinking: {
      // VERP already holds user rows from the old password setup, so a VOSS login
      // arrives at an email that already exists and better-auth refuses to link
      // it: `account_not_linked`.
      //
      // That refusal is the correct DEFAULT. Auto-linking an OAuth identity to an
      // existing account by email is an account takeover whenever the provider
      // does not really verify the address — an attacker registers
      // victim@vit.edu.in at a sloppy provider and inherits the victim's account.
      //
      // VOSS does verify: a one-time code to the real mailbox IS the login, and
      // the @vit.edu.in gate is enforced three times over. That is exactly what
      // trustedProviders means, and "voss" is the only entry. Adding a provider
      // that does not verify email here would reopen the takeover.
      enabled: true,
      trustedProviders: ["voss"],

      // Never link across differing addresses. The email is the entire basis for
      // trusting the link; allowing a mismatch would throw that away.
      allowDifferentEmails: false,

      // trustedProviders alone is NOT enough, and this is the subtle part.
      // better-auth also refuses when the EXISTING LOCAL account has an
      // unverified email (link-account.mjs: `requireLocalEmailVerified &&
      // !dbUser.user.emailVerified`), which defaults to true. Every legacy VERP
      // row is unverified, because the old password signup verified nothing —
      // so the link was refused on the local account, however trusted VOSS is.
      //
      // The attack that check exists to stop: an attacker pre-creates a local
      // account for victim@vit.edu.in (VERP's old signup allowed exactly this —
      // no verification, no domain check), the victim later signs in through a
      // trusted provider, gets linked INTO the attacker's account, and the
      // attacker's password still works.
      //
      // That attack requires the attacker's password to still work. It cannot:
      // emailAndPassword is disabled above, so a legacy row confers no access to
      // anyone. The only way into any account is a VOSS-verified mailbox.
      //
      // This is therefore safe ONLY while passwords stay off. Re-enable
      // emailAndPassword and this becomes an account takeover.
      requireLocalEmailVerified: false,
    },
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
    session: {
      create: {
        after: async (session) => {
          // Bind on every sign-in, not just account creation. This links a
          // first-time user whose roster row already exists, AND re-links a user
          // who signed in BEFORE their TR added them — the promise the pending
          // screen makes ("sign in again and you'll be linked"). bindIdentity is
          // idempotent: once the row carries this authUserId it is a no-op.
          //
          // A throw here must never take the login down — the session cookie is
          // already issued. An unbound account is roleless and lands on the
          // pending screen, which is a correct, self-explaining outcome.
          try {
            const u = await db.query.user.findFirst({
              where: (user, { eq }) => eq(user.id, session.userId),
              columns: { id: true, email: true },
            })
            if (u) await bindIdentity(u.id, u.email)
          } catch (error) {
            console.error("[bind] failed for session", session.userId, error)
          }
        },
      },
    },
  },
})
