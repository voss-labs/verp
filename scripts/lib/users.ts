import { randomBytes } from "node:crypto"
import { neon } from "@neondatabase/serverless"

export interface RoleOption {
  roleName: string
  displayName: string
  description: string | null
  hierarchyLevel: number
}

export async function fetchRoles(directUrl: string): Promise<RoleOption[]> {
  const sql = neon(directUrl)
  const rows = (await sql`
    SELECT role_name, display_name, description, hierarchy_level
    FROM role_definitions
    ORDER BY hierarchy_level DESC
  `) as Array<{
    role_name: string
    display_name: string
    description: string | null
    hierarchy_level: number
  }>
  return rows.map((r) => ({
    roleName: r.role_name,
    displayName: r.display_name,
    description: r.description,
    hierarchyLevel: r.hierarchy_level,
  }))
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  roleName: string
}

export interface CreateUserResult {
  userId: string
  roleAssigned: string
}

export async function createUser(
  input: CreateUserInput,
  directUrl: string
): Promise<CreateUserResult> {
  // Dynamic import so env vars (loaded by setup.ts before this call) are
  // visible when @/lib/auth and @/db initialize their database clients.
  const { auth } = (await import("@/lib/auth")) as typeof import("@/lib/auth")

  const result = (await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  })) as { user?: { id: string } } | { id: string }

  const userId =
    "user" in result && result.user
      ? result.user.id
      : "id" in result
        ? (result as { id: string }).id
        : undefined

  if (!userId) {
    throw new Error("Better Auth signUpEmail did not return a user id")
  }

  const sql = neon(directUrl)
  const roleRows = (await sql`
    SELECT id FROM role_definitions WHERE role_name = ${input.roleName} LIMIT 1
  `) as { id: string }[]

  if (roleRows.length === 0) {
    throw new Error(
      `Role "${input.roleName}" not found in role_definitions. Did migrations run?`
    )
  }

  const roleDefinitionId = roleRows[0].id

  await sql`
    INSERT INTO user_roles (user_id, role_definition_id, assigned_at, is_active)
    VALUES (${userId}, ${roleDefinitionId}, now(), true)
    ON CONFLICT (user_id, role_definition_id)
    DO UPDATE SET is_active = true, updated_at = now()
  `

  return { userId, roleAssigned: input.roleName }
}

export function validateEmail(value: string | undefined): string | undefined {
  if (!value) return "Email is required"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Not a valid email"
  return undefined
}

export function validatePassword(
  value: string | undefined
): string | undefined {
  if (!value) return "Password is required"
  if (value.length < 8) return "Must be at least 8 characters"
  return undefined
}

export function validateName(value: string | undefined): string | undefined {
  if (!value || !value.trim()) return "Name is required"
  if (value.trim().length < 2) return "Name must be at least 2 characters"
  return undefined
}

export function generateRandomPassword(length = 14): string {
  // base64url is alphanumeric + - and _, all safe to copy/paste, no ambiguity.
  const bytes = randomBytes(Math.ceil((length * 3) / 4))
  return bytes.toString("base64url").slice(0, length)
}

export interface QuickSeedAccount {
  roleName: string
  displayName: string
  email: string
  password: string
}

export interface QuickSeedResult {
  created: QuickSeedAccount[]
  skipped: { email: string; reason: string }[]
}

export async function quickSeedDefaults(
  directUrl: string
): Promise<QuickSeedResult> {
  const presets = [
    {
      roleName: "admin",
      displayName: "Administrator",
      email: "admin@example.com",
    },
    {
      roleName: "faculty",
      displayName: "Faculty (TR)",
      email: "faculty@example.com",
    },
    {
      roleName: "student",
      displayName: "Student",
      email: "student@example.com",
    },
  ]

  const created: QuickSeedAccount[] = []
  const skipped: { email: string; reason: string }[] = []

  for (const p of presets) {
    const password = generateRandomPassword(14)
    try {
      await createUser(
        {
          name: p.displayName,
          email: p.email,
          password,
          roleName: p.roleName,
        },
        directUrl
      )
      created.push({ ...p, password })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      skipped.push({ email: p.email, reason: msg })
    }
  }

  return { created, skipped }
}
