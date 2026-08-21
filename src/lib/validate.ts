import { facultyRoleEnum } from "@/db/schema/enums"
import { CAPABILITY_CATALOG, ROLE_DEFAULTS } from "@/lib/rbac"
import type { Capability, Tier } from "@/lib/rbac"

export type FacultyRole = (typeof facultyRoleEnum.enumValues)[number]

const FACULTY_ROLES = new Set<string>(facultyRoleEnum.enumValues)
const CAPABILITIES = new Set<string>(
  CAPABILITY_CATALOG.map((e) => e.capability)
)
const MANAGEABLE_TIERS = new Set<string>(Object.keys(ROLE_DEFAULTS))

export function isFacultyRole(value: unknown): value is FacultyRole {
  return typeof value === "string" && FACULTY_ROLES.has(value)
}

export function isCapability(value: unknown): value is Capability {
  return typeof value === "string" && CAPABILITIES.has(value)
}

export function isManageableTier(
  value: unknown
): value is Exclude<Tier, "super_admin"> {
  return typeof value === "string" && MANAGEABLE_TIERS.has(value)
}
