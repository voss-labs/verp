import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

export const ENV_PATH = resolve(process.cwd(), ".env.local")

export interface EnvValues {
  DATABASE_URL: string
  DIRECT_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
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
    "# Better Auth",
    `BETTER_AUTH_SECRET=${values.BETTER_AUTH_SECRET}`,
    `BETTER_AUTH_URL=${values.BETTER_AUTH_URL}`,
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
