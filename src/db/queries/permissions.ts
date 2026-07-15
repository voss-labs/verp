import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { permissionOverrides } from "@/db/schema"

export async function listRoleOverrides() {
  const rows = await db
    .select({
      tier: permissionOverrides.subjectId,
      capability: permissionOverrides.capability,
      effect: permissionOverrides.effect,
    })
    .from(permissionOverrides)
    .where(
      and(
        eq(permissionOverrides.subjectType, "role"),
        eq(permissionOverrides.isActive, true)
      )
    )
  return rows
}

/**
 * Set (or clear) a role-level override for one capability. Passing effect=null
 * removes the override, returning the capability to its code default. Only one
 * live row per (role, tier, capability) — the old one is retired first.
 */
export async function setRoleOverride(
  tier: string,
  capability: string,
  effect: "grant" | "deny" | null,
  createdBy: string | null
) {
  await db
    .update(permissionOverrides)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(permissionOverrides.subjectType, "role"),
        eq(permissionOverrides.subjectId, tier),
        eq(permissionOverrides.capability, capability),
        eq(permissionOverrides.isActive, true)
      )
    )

  if (effect) {
    await db.insert(permissionOverrides).values({
      subjectType: "role",
      subjectId: tier,
      capability,
      effect,
      createdBy,
    })
  }
}
