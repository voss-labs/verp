import { and, count, eq } from "drizzle-orm"
import { db } from "@/db"
import { faculty, permissionOverrides, students } from "@/db/schema"

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

/**
 * How many people a tier's row actually covers.
 *
 * A permission switch reads as an abstraction until it says who it moves.
 * "Revoke marks:write from faculty" is a shrug; "revoke it from 47 teachers,
 * mid-semester" is a decision. The console cannot ask for confirmation
 * meaningfully without this number.
 *
 * Counted from the tier's own source: a faculty row's role is the tier, and
 * every active student is the student tier. Super-admin is excluded because it
 * holds a wildcard no override can touch.
 */
export async function countUsersByTier(): Promise<Record<string, number>> {
  const [staff, studentRows] = await Promise.all([
    db
      .select({ role: faculty.role, n: count() })
      .from(faculty)
      .where(eq(faculty.isActive, true))
      .groupBy(faculty.role),
    db.select({ n: count() }).from(students).where(eq(students.isActive, true)),
  ])

  const out: Record<string, number> = { hod: 0, faculty: 0, student: 0 }
  for (const row of staff) {
    if (row.role in out) out[row.role] = row.n
  }
  out.student = studentRows[0]?.n ?? 0
  return out
}
