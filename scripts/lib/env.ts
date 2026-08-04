import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

export const ENV_PATH = resolve(process.cwd(), ".env.local")

export const VOSS_DISCOVERY_URL =
  "https://accounts.vosslabs.org/api/auth/.well-known/openid-configuration"

// VERP's own origin in local dev. The redirect URI a contributor registers with
// vauth is derived from it, so both must move together — hence one constant.
export const DEFAULT_APP_URL = "http://localhost:3000"
export const callbackUrl = (appUrl = DEFAULT_APP_URL) =>
  `${appUrl}/api/auth/oauth2/callback/voss`

/**
 * The VOSS_* trio is optional here but required to log in: VERP holds no
 * credentials of its own, so without a registered client the sign-in POST fails
 * with INVALID_OAUTH_CONFIGURATION. The wizard still writes a usable .env.local
 * without them so a contributor can push schema and browse the code first.
 */
export interface EnvValues {
  DATABASE_URL: string
  DIRECT_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  VOSS_DISCOVERY_URL?: string
  VOSS_CLIENT_ID?: string
  VOSS_CLIENT_SECRET?: string
  SUPER_ADMIN_EMAILS?: string
}

export function envExists(): boolean {
  return existsSync(ENV_PATH)
}

export function readEnv(): Partial<EnvValues> {
  if (!envExists()) return {}
  const text = readFileSync(ENV_PATH, "utf8")
  const out: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out as Partial<EnvValues>
}

export function writeEnv(values: EnvValues): void {
  const content = [
    "# Pooled connection - used by the app at runtime",
    `DATABASE_URL="${values.DATABASE_URL}"`,
    "",
    "# Direct (unpooled) connection - used by Drizzle Studio and migrations",
    `DIRECT_URL="${values.DIRECT_URL}"`,
    "",
    "# Better Auth runs as the relying party: it signs VERP's own session and",
    "# PKCE/state cookies. Required even though VOSS is the identity provider.",
    `BETTER_AUTH_SECRET=${values.BETTER_AUTH_SECRET}`,
    `BETTER_AUTH_URL=${values.BETTER_AUTH_URL}`,
    "",
    "# VOSS Auth (accounts.vosslabs.org). Register VERP as a client in the vauth",
    "# repo; the secret is hashed at rest there and shown exactly once. The",
    "# redirect URI to register is <BETTER_AUTH_URL>/api/auth/oauth2/callback/voss",
    `VOSS_DISCOVERY_URL="${values.VOSS_DISCOVERY_URL ?? VOSS_DISCOVERY_URL}"`,
    `VOSS_CLIENT_ID="${values.VOSS_CLIENT_ID ?? ""}"`,
    `VOSS_CLIENT_SECRET="${values.VOSS_CLIENT_SECRET ?? ""}"`,
    "",
    "# Comma-separated allowlist. These logins ARE super_admin with or without a",
    "# faculty row - the single bootstrap door, since there is no seed admin.",
    `SUPER_ADMIN_EMAILS="${values.SUPER_ADMIN_EMAILS ?? ""}"`,
    "",
  ].join("\n")
  writeFileSync(ENV_PATH, content, "utf8")
}

export function generateAuthSecret(): string {
  return randomBytes(32).toString("base64")
}

export function validatePooledUrl(
  value: string | undefined
): string | undefined {
  if (!value) return "URL is required"
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    return "Must start with postgresql://"
  }
  if (!value.includes("-pooler")) {
    return 'Pooled URL must contain "-pooler" in the host (you may have pasted the direct one)'
  }
  if (!value.includes("sslmode=require")) {
    return "Missing sslmode=require"
  }
  return undefined
}

export function validateDirectUrl(
  value: string | undefined
): string | undefined {
  if (!value) return "URL is required"
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    return "Must start with postgresql://"
  }
  if (value.includes("-pooler")) {
    return 'Direct URL must NOT contain "-pooler" (you may have pasted the pooled one)'
  }
  if (!value.includes("sslmode=require")) {
    return "Missing sslmode=require"
  }
  return undefined
}

export function maskUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.password) u.password = "•".repeat(6)
    return u.toString()
  } catch {
    return url
  }
}
